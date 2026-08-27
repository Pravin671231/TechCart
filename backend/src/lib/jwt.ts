import jwt from "jsonwebtoken";
import { env } from "@/config/env";

const JWT_ALGORITHM = "HS256";

// Fixed 90-day outer bound (Issue #267/M3.27) — independent of session.ts's
// own rolling 30-day window, which is what actually enforces expiry day to
// day. This only ever matters for a session nobody has verified in 90 days.
const JWT_OUTER_TTL_SECONDS = 90 * 24 * 60 * 60;

export interface SessionJwtPayload {
  sub: string; // userId
  role: string;
  jti: string;
}

export function signSessionJwt(payload: SessionJwtPayload): string {
  return jwt.sign({ role: payload.role }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    subject: payload.sub,
    jwtid: payload.jti,
    expiresIn: JWT_OUTER_TTL_SECONDS,
  });
}

// Returns null on ANY verification failure (bad signature, malformed,
// expired, wrong algorithm, missing claims) — the caller (session.ts)
// doesn't need to distinguish these; jsonwebtoken itself throws a mix of
// JsonWebTokenError/TokenExpiredError for all of them uniformly.
export function verifySessionJwt(token: string): SessionJwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded.sub !== "string" ||
      typeof decoded.jti !== "string" ||
      typeof (decoded as Record<string, unknown>).role !== "string"
    ) {
      return null;
    }
    return {
      sub: decoded.sub,
      jti: decoded.jti,
      role: (decoded as Record<string, unknown>).role as string,
    };
  } catch {
    return null;
  }
}
