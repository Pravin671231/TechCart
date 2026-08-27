import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { extractSessionToken, setSessionCookie, verifySessionToken } from "@/lib/session";
import { successResponse } from "@/utils/apiResponse";
import {
  getSessionUser,
  requestBuyerOtp,
  signInWithGoogle,
  signOutSession,
  verifyBuyerOtp,
  type SignInMeta,
  type SignInResult,
} from "./auth.service";

const oneTapSchema = z.object({ idToken: z.string().min(1) });
const sendOtpSchema = z.object({ email: z.string().email() });
const verifyOtpSchema = z.object({ email: z.string().email(), otp: z.string().min(1) });

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
