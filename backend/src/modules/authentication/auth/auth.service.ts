import { Types } from "mongoose";
import { sendOtpEmail } from "@/externalService/mailer";
import { verifyGoogleIdToken } from "@/lib/googleAuth";
import { requestOtp, verifyOtp } from "@/lib/otp";
import { consumeEmailLimit, consumeIpLimit } from "@/lib/rateLimit";
import { issueSession, revokeSession, verifySessionToken } from "@/lib/session";
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
