import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  clearAdminChallenge,
  issueAdminChallenge,
  readAdminChallenge,
} from "@/lib/adminChallenge";
import { extractSessionToken, setSessionCookie, verifySessionToken } from "@/lib/session";
import { AppError } from "@/utils/AppError";
import { successResponse } from "@/utils/apiResponse";
import {
  adminPasswordSignIn,
  adminResendOtp,
  adminVerifyOtp,
  getSessionUser,
  requestAdminPasswordReset,
  requestBuyerOtp,
  resetAdminPassword,
  signInWithGoogle,
  signOutSession,
  verifyBuyerOtp,
  type SignInMeta,
  type SignInResult,
} from "./auth.service";

const oneTapSchema = z.object({ idToken: z.string().min(1) });
const sendOtpSchema = z.object({ email: z.string().email() });
const verifyOtpSchema = z.object({ email: z.string().email(), otp: z.string().min(1) });

const adminSignInSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const adminVerifyOtpSchema = z.object({ code: z.string().min(1) });
const requestPasswordResetSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({ token: z.string().min(1), newPassword: z.string().min(8) });

// Better Auth's own advanced.ipAddress resolution is a single-hop,
// x-forwarded-for-trusting simplification (no trustedProxies configured,
// per Issue #145/M3.7's own documented interpretive call) — matched here
// rather than introducing a second, differently-behaved IP-resolution
// convention for the same deployment shape.
function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]?.trim();
  }
  return req.socket.remoteAddress;
}

function getSignInMeta(req: Request): SignInMeta {
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"];
  return {
    ...(ip !== undefined ? { ip } : {}),
    ...(typeof userAgent === "string" ? { userAgent } : {}),
  };
}

function respondWithSession(res: Response, result: SignInResult): void {
  setSessionCookie(res, result.token, result.expiresAt);
  res.setHeader("set-auth-token", result.token);
  res.status(200).json(successResponse(result.user));
}

export async function oneTapCallbackHandler(req: Request, res: Response): Promise<void> {
  const { idToken } = oneTapSchema.parse(req.body);
  const result = await signInWithGoogle(idToken, getSignInMeta(req));
  respondWithSession(res, result);
}

export async function sendVerificationOtpHandler(req: Request, res: Response): Promise<void> {
  const { email } = sendOtpSchema.parse(req.body);
  await requestBuyerOtp(email, getSignInMeta(req));
  res.status(200).json(successResponse(null));
}

export async function signInEmailOtpHandler(req: Request, res: Response): Promise<void> {
  const { email, otp } = verifyOtpSchema.parse(req.body);
  const result = await verifyBuyerOtp(email, otp, getSignInMeta(req));
  respondWithSession(res, result);
}

// Falls through to Better Auth (the router's own catch-all, mounted after
// this handler) for an admin session — see auth.routes.ts.
export async function getSessionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractSessionToken(req);
  if (!token) {
    next();
    return;
  }
  const user = await getSessionUser(token);
  if (!user) {
    next();
    return;
  }
  res.status(200).json(successResponse({ user }));
}

export async function signOutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractSessionToken(req);
  if (!token) {
    next();
    return;
  }
  const result = await verifySessionToken(token);
  if (!result.ok) {
    next();
    return;
  }
  await signOutSession(result.jti);
  res.status(200).json(successResponse(null));
}

// --- Admin password + mandatory OTP (Issue #259/M3.21) -------------------

const CHALLENGE_MISSING = new AppError(
  401,
  "INVALID_TWO_FACTOR_COOKIE",
  "Your sign-in session has expired. Start again.",
);

export async function adminSignInHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = adminSignInSchema.parse(req.body);
  const challenge = await adminPasswordSignIn(email, password, getSignInMeta(req));
  issueAdminChallenge(res, challenge);
  // No session yet — the mandatory OTP step (FR-AUTH-014) still has to pass.
  // admin-app reads data.code === "OTP_REQUIRED" to advance to the OTP screen.
  res.status(200).json(successResponse({ code: "OTP_REQUIRED" }));
}

export async function adminSendOtpHandler(req: Request, res: Response): Promise<void> {
  const challenge = readAdminChallenge(req);
  if (!challenge) throw CHALLENGE_MISSING;
  await adminResendOtp(challenge, getSignInMeta(req));
  res.status(200).json(successResponse({}));
}

export async function adminVerifyOtpHandler(req: Request, res: Response): Promise<void> {
  const challenge = readAdminChallenge(req);
  if (!challenge) throw CHALLENGE_MISSING;
  const { code } = adminVerifyOtpSchema.parse(req.body);
  const result = await adminVerifyOtp(challenge, code, getSignInMeta(req));

  clearAdminChallenge(res);
  setSessionCookie(res, result.token, result.expiresAt);
  res.setHeader("set-auth-token", result.token);
  res.status(200).json(successResponse({ user: result.user }));
}

export async function requestPasswordResetHandler(req: Request, res: Response): Promise<void> {
  const { email } = requestPasswordResetSchema.parse(req.body);
  await requestAdminPasswordReset(email, getSignInMeta(req));
  // Identical response regardless of whether the email is registered
  // (FR-AUTH-019).
  res.status(200).json(successResponse({ status: "ok" }));
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  await resetAdminPassword(token, newPassword);
  res.status(200).json(successResponse({ status: "ok" }));
}
