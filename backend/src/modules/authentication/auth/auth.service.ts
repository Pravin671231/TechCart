import crypto from "node:crypto";
import { Types } from "mongoose";
import { env } from "@/config/env";
import { sendOtpEmail, sendPasswordResetEmail } from "@/externalService/mailer";
import { verifyGoogleIdToken } from "@/lib/googleAuth";
import { requestOtp, verifyOtp } from "@/lib/otp";
import { hashPassword, verifyPassword } from "@/lib/password";
import { consumeResetToken, recordResetToken } from "@/lib/passwordResetTokens";
import { consumeEmailLimit, consumeIpLimit } from "@/lib/rateLimit";
import {
  issueSession,
  revokeAllSessionsForUser,
  revokeSession,
  verifySessionToken,
} from "@/lib/session";
import { AppError } from "@/utils/AppError";
import * as authRepository from "./auth.repository";
import type { UserRecord } from "./auth.repository";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
}

export interface SignInMeta {
  ip?: string;
  userAgent?: string;
}

export interface SignInResult {
  user: SessionUser;
  token: string;
  expiresAt: Date;
}

const GOOGLE_ACCOUNT_IS_ADMIN_MESSAGE =
  "This email belongs to an admin account. Sign in from the admin console instead.";

function toSessionUser(record: UserRecord): SessionUser {
  return {
    id: record._id.toString(),
    name: record.name,
    email: record.email,
    role: record.role,
    ...(record.phone !== undefined ? { phone: record.phone } : {}),
  };
}

async function findOrCreateBuyer(email: string, name: string): Promise<UserRecord> {
  const existing = await authRepository.findUserByEmail(email);
  if (existing) return existing;
  return authRepository.createBuyer({ email, name });
}

async function rejectIfNonBuyer(email: string): Promise<void> {
  if (await authRepository.isNonBuyer(email)) {
    throw new AppError(403, "GOOGLE_ACCOUNT_IS_ADMIN", GOOGLE_ACCOUNT_IS_ADMIN_MESSAGE);
  }
}

async function issueBuyerSession(user: UserRecord, meta: SignInMeta): Promise<SignInResult> {
  await authRepository.touchLastSignIn(user._id);
  const issued = await issueSession({
    userId: user._id.toString(),
    role: "buyer",
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  });
  return { user: toSessionUser(user), token: issued.token, expiresAt: issued.expiresAt };
}

export async function signInWithGoogle(idToken: string, meta: SignInMeta): Promise<SignInResult> {
  // Checked before token verification, not after — every call counts
  // against the bucket regardless of whether the token turns out valid,
  // matching FR-AUTH-044's automated-account-creation-spam intent and the
  // native Better-Auth rate limiter's own before-any-endpoint-logic timing
  // this replaces.
  if (meta.ip !== undefined) {
    const ipLimit = await consumeIpLimit("buyer-google-signin", meta.ip);
    if (!ipLimit.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
    }
  }

  const identity = await verifyGoogleIdToken(idToken);
  if (!identity) {
    throw new AppError(401, "INVALID_GOOGLE_TOKEN", "Could not verify Google account.");
  }
  await rejectIfNonBuyer(identity.email);

  const user = await findOrCreateBuyer(identity.email, identity.name);
  return issueBuyerSession(user, meta);
}

export async function requestBuyerOtp(email: string, meta: SignInMeta): Promise<void> {
  await rejectIfNonBuyer(email);
  if (await authRepository.isDeactivated(email)) {
    throw new AppError(403, "ACCOUNT_DEACTIVATED", "This account has been deactivated.");
  }

  const emailLimit = await consumeEmailLimit("buyer-otp-request", email);
  if (!emailLimit.allowed) {
    throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
  }
  if (meta.ip !== undefined) {
    const ipLimit = await consumeIpLimit("buyer-otp-request", meta.ip);
    if (!ipLimit.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
    }
  }

  const code = await requestOtp(email, "buyer-sign-in");
  await sendOtpEmail(email, code, "sign-in");
}

export async function verifyBuyerOtp(email: string, code: string, meta: SignInMeta): Promise<SignInResult> {
  await rejectIfNonBuyer(email);

  const result = await verifyOtp(email, "buyer-sign-in", code);
  if (!result.ok) {
    if (result.reason === "otp_expired") {
      throw new AppError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
    }
    throw new AppError(400, "INVALID_OTP", "Incorrect or expired code.");
  }

  // OTP sign-in carries no display name — defaults to the email itself,
  // same as the account's only other identifying field at creation time;
  // the buyer can change it later via their own profile.
  const user = await findOrCreateBuyer(email, email);
  return issueBuyerSession(user, meta);
}

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  const result = await verifySessionToken(token);
  if (!result.ok) return null;

  const user = await authRepository.findUserById(new Types.ObjectId(result.userId));
  if (!user) return null;
  return toSessionUser(user);
}

export async function signOutSession(jti: string): Promise<void> {
  await revokeSession(jti);
}

// ---------------------------------------------------------------------------
// Admin password + mandatory OTP (Issue #259/M3.21, FR-AUTH-009–017, 030)
// ---------------------------------------------------------------------------
// Hand-rolled replacement for Better Auth's emailAndPassword + twoFactor
// plugins, on #257's session engine + #258's `otps` collection. Wire-
// compatible with admin-app's existing flow (Issue #148/M3.10) — same
// endpoint paths, response shapes, and error codes. The "which admin is
// mid-sign-in" state between the password step and the two OTP steps rides a
// signed cookie (adminChallenge.ts), since those two requests carry no email.

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export interface AdminChallengeIssued {
  userId: string;
}

function rateLimited(): AppError {
  return new AppError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
}

function assertActiveAdmin(user: UserRecord | null): asserts user is UserRecord {
  // A missing user / a buyer-role account at an OTP step means the challenge
  // cookie no longer maps to a valid pending admin sign-in — treat it the
  // same as a missing/expired cookie so admin-app's INVALID_TWO_FACTOR_COOKIE
  // branch handles it.
  if (!user || user.role === "buyer") {
    throw new AppError(
      401,
      "INVALID_TWO_FACTOR_COOKIE",
      "Your sign-in session has expired. Start again.",
    );
  }
  if (user.status === false) {
    throw new AppError(403, "ACCOUNT_DEACTIVATED", "This account has been deactivated.");
  }
}

export async function adminPasswordSignIn(
  email: string,
  password: string,
  meta: SignInMeta,
): Promise<AdminChallengeIssued> {
  if (meta.ip !== undefined) {
    const ipLimit = await consumeIpLimit("admin-signin", meta.ip);
    if (!ipLimit.allowed) throw rateLimited();
  }
  const emailLimit = await consumeEmailLimit("admin-signin", email);
  if (!emailLimit.allowed) throw rateLimited();

  const user = await authRepository.findUserByEmail(email);

  // Deactivation is checked ahead of the password (matches the pre-#259
  // Better Auth hook ordering, enforceAccountNotDeactivated) — a deactivated
  // admin gets ACCOUNT_DEACTIVATED regardless of whether the password is
  // right, and no OTP is sent.
  if (user && user.status === false) {
    throw new AppError(403, "ACCOUNT_DEACTIVATED", "This account has been deactivated.");
  }

  // Unknown email, wrong password, a buyer-role account, and an admin with no
  // password hash all collapse to one generic error (FR-AUTH-010).
  if (
    !user ||
    user.role === "buyer" ||
    !user.passwordHash ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    throw new AppError(401, "INVALID_EMAIL_OR_PASSWORD", INVALID_CREDENTIALS_MESSAGE);
  }

  // The OTP itself is minted + emailed by the /two-factor/send-otp step,
  // which admin-app calls immediately after this one (and again for
  // "Resend"). The password step only establishes the pending challenge.
  return { userId: user._id.toString() };
}

export async function adminResendOtp(
  challenge: AdminChallengeIssued,
  meta: SignInMeta,
): Promise<void> {
  if (meta.ip !== undefined) {
    const ipLimit = await consumeIpLimit("admin-otp-resend", meta.ip);
    if (!ipLimit.allowed) throw rateLimited();
  }
  const user = await authRepository.findUserById(new Types.ObjectId(challenge.userId));
  assertActiveAdmin(user);

  const code = await requestOtp(user.email, "admin-2fa");
  await sendOtpEmail(user.email, code, "sign-in");
}

export async function adminVerifyOtp(
  challenge: AdminChallengeIssued,
  code: string,
  meta: SignInMeta,
): Promise<SignInResult> {
  if (meta.ip !== undefined) {
    const ipLimit = await consumeIpLimit("admin-otp-verify", meta.ip);
    if (!ipLimit.allowed) throw rateLimited();
  }
  const user = await authRepository.findUserById(new Types.ObjectId(challenge.userId));
  assertActiveAdmin(user);

  const result = await verifyOtp(user.email, "admin-2fa", code);
  if (!result.ok) {
    if (result.reason === "otp_expired") {
      throw new AppError(401, "OTP_HAS_EXPIRED", "This code has expired. Request a new one.");
    }
    // A wrong code and an already-consumed one both surface as INVALID_CODE
    // — matching the admin twoFactor plugin's own wrong-code error value
    // that admin-app's describeAuthError.ts already keys on.
    throw new AppError(401, "INVALID_CODE", "Incorrect or expired code.");
  }

  await authRepository.touchLastSignIn(user._id);
  const issued = await issueSession({
    userId: user._id.toString(),
    role: user.role,
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  });

  return { user: toSessionUser(user), token: issued.token, expiresAt: issued.expiresAt };
}

// ---------------------------------------------------------------------------
// Admin password reset (Issue #259/M3.21, FR-AUTH-019–022) — hand-rolled onto
// the same `passwordResetTokens` collection Issue #141's sendResetPassword
// callback already recorded into. Removes the last Better Auth dependency
// from the reset flow (#260 just deletes the dead emailAndPassword config).
// ---------------------------------------------------------------------------

const RESET_TOKEN_BYTES = 32;

function buildAdminResetUrl(token: string): string {
  const origin = env.CORS_ORIGINS.split(",")[0]?.trim() || env.BETTER_AUTH_URL;
  return `${origin.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

async function issueAdminResetLink(user: UserRecord): Promise<void> {
  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("base64url");
  await recordResetToken(token, user._id.toString());
  await sendPasswordResetEmail(user.email, buildAdminResetUrl(token));
}

export async function requestAdminPasswordReset(email: string, meta: SignInMeta): Promise<void> {
  // Rate-limited but never reveals whether the email is registered
  // (FR-AUTH-019) — the caller-visible outcome is identical either way.
  if (meta.ip !== undefined) {
    const ipLimit = await consumeIpLimit("admin-forgot-password", meta.ip);
    if (!ipLimit.allowed) throw rateLimited();
  }
  const emailLimit = await consumeEmailLimit("admin-forgot-password", email);
  if (!emailLimit.allowed) throw rateLimited();

  const user = await authRepository.findUserByEmail(email);
  if (!user || user.role === "buyer") return;
  await issueAdminResetLink(user);
}

// Internal counterpart used by admin provisioning (Issue #142/M3.4) — a
// newly-created admin has no password yet and is routed straight through
// the reset flow to set one. No rate limiting: this isn't a
// publicly-reachable request, it's a super-admin action already gated by
// rbac(["super-admin"]).
export async function sendAdminPasswordResetLink(email: string): Promise<void> {
  const user = await authRepository.findUserByEmail(email);
  if (!user || user.role === "buyer") return;
  await issueAdminResetLink(user);
}

export async function resetAdminPassword(token: string, newPassword: string): Promise<void> {
  const userId = await consumeResetToken(token);
  if (!userId) {
    throw new AppError(400, "INVALID_RESET_TOKEN", "This reset link is invalid or has expired.");
  }

  const objectId = new Types.ObjectId(userId);
  await authRepository.updatePasswordHash(objectId, await hashPassword(newPassword));
  // FR-AUTH-022 — every existing session for this admin is invalidated.
  await revokeAllSessionsForUser(userId);
}
