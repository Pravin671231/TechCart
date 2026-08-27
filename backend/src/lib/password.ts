import bcrypt from "bcryptjs";

// Admin password hashing (Issue #259/M3.21). Admins are the only role with a
// password — buyers are passwordless (Issue #258/M3.20) — so this lives in
// `src/lib/` alongside the other auth primitives (jwt.ts, session.ts,
// otp.ts) rather than in any one module. bcryptjs (pure JS, no native build)
// over `bcrypt` so Render/Vercel/Windows-dev builds never need node-gyp.

const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
