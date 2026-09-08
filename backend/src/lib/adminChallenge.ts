import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { env } from "@/config/env";

// Admin 2FA pending-challenge state (Issue #259/M3.21) — the hand-rolled
// replacement for Better Auth's `twoFactor` plugin's own pending-challenge
// cookie. `POST /api/auth/two-factor/send-otp` and `/verify-otp` carry no
// email in their request body (just `{}` / `{code}`), so "which admin is
// mid-sign-in" is carried here, set at the password step and read by the
// two OTP steps.
//
// It's a short-lived signed JWT (HS256, `JWT_SECRET`, 10-minute expiry
// matching the OTP's own TTL), delivered two ways at once:
//   - an httpOnly cookie (`techcart_admin_2fa`) — works for a same-site
//     client (local dev, Supertest).
//   - the `x-admin-2fa-challenge` response header — for a cross-site client
//     (admin-app on Vercel → backend on Render), where Safari blocks the
//     third-party cookie outright and Chrome increasingly does too. The
//     client stores the header value and resends it as the same header on
//     the two OTP steps. Mirrors the `set-auth-token` bearer mechanism
//     (`FR-AUTH-046`) exactly.
// `readAdminChallenge` accepts either; the header wins when both are present.
//
// The SameSite=None; Secure gate mirrors session.ts's isCrossSiteDeployment
// exactly.

const CHALLENGE_COOKIE_NAME = "techcart_admin_2fa";
export const CHALLENGE_HEADER = "x-admin-2fa-challenge";
const CHALLENGE_TTL_SECONDS = 10 * 60; // 10 minutes — matches otp.ts's OTP_TTL_MS
const CHALLENGE_TYP = "admin-2fa";
const JWT_ALGORITHM = "HS256";

const isCrossSiteDeployment = env.APP_BASE_URL.startsWith("https://");

export interface AdminChallenge {
  userId: string;
}

// Sign the pending-challenge JWT, set the httpOnly cookie, and return the
// token so the caller can also surface it via the `x-admin-2fa-challenge`
// response header for a cross-site client.
export function issueAdminChallenge(res: Response, challenge: AdminChallenge): string {
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

  return token;
}

function verifyChallengeToken(token: string): AdminChallenge | null {
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

// No cookie-parser dependency exists in this app (app.ts has none) — the raw
// Cookie header is parsed by hand, mirroring session.ts's extractSessionToken.
export function readAdminChallenge(req: Request): AdminChallenge | null {
  const headerValue = req.headers[CHALLENGE_HEADER];
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (headerToken) {
    const fromHeader = verifyChallengeToken(headerToken);
    if (fromHeader) return fromHeader;
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const prefix = `${CHALLENGE_COOKIE_NAME}=`;
  const match = cookieHeader.split("; ").find((c) => c.startsWith(prefix));
  if (!match) return null;

  return verifyChallengeToken(decodeURIComponent(match.slice(prefix.length)));
}

export function clearAdminChallenge(res: Response): void {
  res.clearCookie(CHALLENGE_COOKIE_NAME, {
    httpOnly: true,
    secure: isCrossSiteDeployment,
    sameSite: isCrossSiteDeployment ? "none" : "lax",
    path: "/",
  });
}
