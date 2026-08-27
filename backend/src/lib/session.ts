import crypto from "node:crypto";
import type { Request, Response } from "express";
import { Schema, model } from "mongoose";
import { env } from "@/config/env";
import { signSessionJwt, verifySessionJwt } from "@/lib/jwt";

// The session-token engine (Issue #257/M3.19, amended by #267/M3.27) — the
// hybrid JWT + DB-row model every auth flow and rbac.ts run on since #258–261.
// The token is a signed JWT, but a live, non-revoked row here is still
// required on every verification, since FR-AUTH-017/022/026/039 need
// instant/selective revocation a stateless JWT alone can't provide.

export type SessionDocument = {
  _id: string; // the JWT's own `jti` claim — NOT an ObjectId, NOT hashed
  userId: string;
  expiresAt: Date; // rolling 30-day window, extended on every successful verify
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
};

const sessionSchema = new Schema<SessionDocument>({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

// TTL index, mirrors passwordResetTokens.ts's own precedent — Mongo
// garbage-collects a row once its rolling window has lapsed, even if
// nothing ever calls verifySessionToken on it again to trigger that check.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// revokeAllSessionsForUser's filter key.
sessionSchema.index({ userId: 1 });

const Session = model<SessionDocument>("Session", sessionSchema);

const SESSION_ROLLING_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — FR-AUTH-016
const SESSION_COOKIE_NAME = "techcart_session";

// A no-op in dev/test (APP_BASE_URL is http:// there), real once deployed
// behind https — buyer-app/admin-app (Vercel) are cross-site from backend
// (Render), so the session cookie needs SameSite=None; Secure to be sent.
const isCrossSiteDeployment = env.APP_BASE_URL.startsWith("https://");

export interface IssueSessionInput {
  userId: string;
  role: string;
  ip?: string;
  userAgent?: string;
}

export interface IssuedSession {
  token: string;
  jti: string;
  expiresAt: Date;
}

export async function issueSession(input: IssueSessionInput): Promise<IssuedSession> {
  const jti = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_ROLLING_TTL_MS);

  await Session.create({
    _id: jti,
    userId: input.userId,
    expiresAt,
    createdAt: new Date(),
    ...(input.ip !== undefined ? { ipAddress: input.ip } : {}),
    ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
  });

  const token = signSessionJwt({ sub: input.userId, role: input.role, jti });

  return { token, jti, expiresAt };
}

export type VerifySessionResult =
  | { ok: true; userId: string; role: string; jti: string }
  | { ok: false; reason: "invalid_token" | "session_expired" };

export async function verifySessionToken(token: string): Promise<VerifySessionResult> {
  const decoded = verifySessionJwt(token);
  if (!decoded) return { ok: false, reason: "invalid_token" };

  // Atomic check-and-extend: a live row's rolling window advances on every
  // successful verification (FR-AUTH-016); a missing or already-lapsed row
  // (including one deleted by revokeSession/revokeAllSessionsForUser)
  // rejects identically — a revoked session and a naturally expired one are
  // deliberately indistinguishable here.
  const newExpiresAt = new Date(Date.now() + SESSION_ROLLING_TTL_MS);
  const updated = await Session.findOneAndUpdate(
    { _id: decoded.jti, expiresAt: { $gt: new Date() } },
    { $set: { expiresAt: newExpiresAt } },
  ).lean();

  if (!updated) return { ok: false, reason: "session_expired" };
  return { ok: true, userId: decoded.sub, role: decoded.role, jti: decoded.jti };
}

export async function revokeSession(jti: string): Promise<void> {
  await Session.deleteOne({ _id: jti });
}

export async function revokeAllSessionsForUser(userId: string, excludeJti?: string): Promise<void> {
  const filter: Record<string, unknown> = { userId };
  if (excludeJti) {
    filter._id = { $ne: excludeJti };
  }
  await Session.deleteMany(filter);
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isCrossSiteDeployment,
    sameSite: isCrossSiteDeployment ? "none" : "lax",
    expires: expiresAt,
    path: "/",
  });
}

// Authorization: Bearer wins over the cookie when both are present —
// mirrors account.service.ts's existing bearer-parsing convention. No
// cookie-parser dependency exists (or is added here) — app.ts has none
// installed and this issue adds no route, so the raw Cookie header is
// parsed by hand.
export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const prefix = `${SESSION_COOKIE_NAME}=`;
  const match = cookieHeader.split("; ").find((c) => c.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}
