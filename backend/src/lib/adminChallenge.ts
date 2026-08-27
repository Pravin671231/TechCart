import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { env } from "@/config/env";

// Admin 2FA pending-challenge cookie (Issue #259/M3.21) — the hand-rolled
// replacement for Better Auth's `twoFactor` plugin's own pending-challenge
// cookie. `POST /api/auth/two-factor/send-otp` and `/verify-otp` carry no
// email in their request body (just `{}` / `{code}`), so "which admin is
// mid-sign-in" is carried here, set at the password step and read by the
// two OTP steps.
//
// It's a short-lived signed JWT (HS256, `JWT_SECRET`, 10-minute expiry
// matching the OTP's own TTL), delivered as an httpOnly cookie. The
// SameSite=None; Secure gate mirrors session.ts's isCrossSiteDeployment
// exactly — admin-app (Vercel) is cross-domain from backend (Render), and a
// SameSite=Lax cookie is never sent on that cross-site fetch.

const CHALLENGE_COOKIE_NAME = "techcart_admin_2fa";
const CHALLENGE_TTL_SECONDS = 10 * 60; // 10 minutes — matches otp.ts's OTP_TTL_MS
const CHALLENGE_TYP = "admin-2fa";
const JWT_ALGORITHM = "HS256";

const isCrossSiteDeployment = env.APP_BASE_URL.startsWith("https://");

export interface AdminChallenge {
  userId: string;
}

export function issueAdminChallenge(res: Response, challenge: AdminChallenge): void {
  const token = jwt.sign({ typ: CHALLENGE_TYP }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    subject: challenge.userId,
    expiresIn: CHALLENGE_TTL_SECONDS,
  });

  res.cookie(CHALLENGE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isCrossSiteDeployment,
    sameSite: isCrossSiteDeployment ? "none" : "lax",
    maxAge: CHALLENGE_TTL_SECONDS * 1000,
    path: "/",
  });
}

// No cookie-parser dependency exists in this app (app.ts has none) — the raw
// Cookie header is parsed by hand, mirroring session.ts's extractSessionToken.
export function readAdminChallenge(req: Request): AdminChallenge | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const prefix = `${CHALLENGE_COOKIE_NAME}=`;
  const match = cookieHeader.split("; ").find((c) => c.startsWith(prefix));
  if (!match) return null;

  const token = decodeURIComponent(match.slice(prefix.length));
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      (decoded as Record<string, unknown>).typ !== CHALLENGE_TYP ||
      typeof decoded.sub !== "string"
    ) {
      return null;
    }
    return { userId: decoded.sub };
  } catch {
    return null;
  }
}

export function clearAdminChallenge(res: Response): void {
  res.clearCookie(CHALLENGE_COOKIE_NAME, {
    httpOnly: true,
    secure: isCrossSiteDeployment,
    sameSite: isCrossSiteDeployment ? "none" : "lax",
    path: "/",
  });
}
