import Redis from "ioredis";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { env } from "@/config/env";

// Issue #145/M3.7 (FR-AUTH-040–044), reworked by #258/#259 once the auth
// routes became hand-rolled. Two consumers, both calling in directly from the
// hand-rolled sign-in / OTP / password-reset handlers (auth.service.ts):
//
// 1. `consumeIpLimit` — the per-IP dimension of FR-AUTH-040–044, keyed off
//    the request's `x-forwarded-for` (single-value, trusted directly — a
//    single-hop PaaS deployment shape).
// 2. `consumeEmailLimit` — the per-email dimension of FR-AUTH-040/042/043,
//    for the paths whose request body carries an email.
//
// Both funnel through the same generic `consume()` so there's one Redis
// client and one library in this file.

const isTestEnv = env.NODE_ENV === "test";

// Vitest's injected REDIS_URL (vitest.config.ts) is a dummy value with
// nothing listening on it — never actually connect to it.
const redisClient = isTestEnv ? null : new Redis(env.REDIS_URL);

// Limiter instances are created lazily per distinct (keyPrefix, points,
// duration) triple and cached — consumeIpLimit's and consumeEmailLimit's
// groups all go through this same cache, keyed by their own fixed values.
const limiters = new Map<string, RateLimiterMemory | RateLimiterRedis>();

function getLimiter(keyPrefix: string, points: number, duration: number): RateLimiterMemory | RateLimiterRedis {
  const cacheKey = `${keyPrefix}:${points}:${duration}`;
  const existing = limiters.get(cacheKey);
  if (existing) return existing;

  const limiter = isTestEnv
    ? new RateLimiterMemory({ keyPrefix, points, duration })
    : new RateLimiterRedis({
        storeClient: redisClient!,
        keyPrefix,
        points,
        duration,
        // A transient Redis outage degrades to a per-instance in-memory
        // limit instead of crashing every auth request or silently
        // disabling rate limiting altogether.
        insuranceLimiter: new RateLimiterMemory({ keyPrefix, points, duration }),
      });
  limiters.set(cacheKey, limiter);
  return limiter;
}

interface ConsumeResult {
  allowed: boolean;
  retryAfter: number | null;
}

async function consume(
  keyPrefix: string,
  key: string,
  points: number,
  duration: number,
): Promise<ConsumeResult> {
  const limiter = getLimiter(keyPrefix, points, duration);
  try {
    await limiter.consume(key);
    return { allowed: true, retryAfter: null };
  } catch (rejection) {
    const msBeforeNext = (rejection as { msBeforeNext?: number })?.msBeforeNext ?? duration * 1000;
    return { allowed: false, retryAfter: Math.ceil(msBeforeNext / 1000) };
  }
}

export type EmailLimitGroup =
  | "admin-signin"
  | "admin-forgot-password"
  | "buyer-otp-request";

// FR-AUTH-040/042/043's per-email limits, enforced in the hand-rolled
// sign-in / OTP-request / password-reset handlers (auth.service.ts).

const EMAIL_LIMIT_CONFIG: Record<EmailLimitGroup, { points: number; duration: number }> = {
  // FR-AUTH-040 — admin sign-in, per email. The /two-factor/verify-otp leg of
  // this same named limit has no email in its request body (just {code}) and
  // stays IP-only via consumeIpLimit — documented, accepted scope, same
  // treatment this codebase gives other infra-shaped gaps.
  "admin-signin": { points: 5, duration: 900 }, // 5 / 15 min
  // FR-AUTH-042 — admin forgot-password, per email.
  "admin-forgot-password": { points: 3, duration: 3600 }, // 3 / 1 hour
  // FR-AUTH-043 — buyer OTP request, per email.
  "buyer-otp-request": { points: 5, duration: 600 }, // 5 / 10 min
};

export async function consumeEmailLimit(
  group: EmailLimitGroup,
  email: string,
): Promise<ConsumeResult> {
  const config = EMAIL_LIMIT_CONFIG[group];
  return consume(`email:${group}`, email.toLowerCase(), config.points, config.duration);
}

// FR-AUTH-040–044's per-IP limits, enforced in the hand-rolled auth handlers
// (auth.service.ts) — one group per rate-limited path.
export type IpLimitGroup =
  | "buyer-google-signin"
  | "buyer-otp-request"
  | "admin-signin"
  | "admin-otp-verify"
  | "admin-otp-resend"
  | "admin-forgot-password";

const IP_LIMIT_CONFIG: Record<IpLimitGroup, { points: number; duration: number }> = {
  "buyer-google-signin": { points: 20, duration: 3600 }, // FR-AUTH-044 — POST /one-tap/callback
  "buyer-otp-request": { points: 5, duration: 600 }, // FR-AUTH-043 (IP half) — POST /email-otp/send-verification-otp
  "admin-signin": { points: 5, duration: 900 }, // FR-AUTH-040 — POST /sign-in/email
  "admin-otp-verify": { points: 5, duration: 900 }, // FR-AUTH-040 — POST /two-factor/verify-otp
  "admin-otp-resend": { points: 3, duration: 600 }, // FR-AUTH-041 — POST /two-factor/send-otp
  "admin-forgot-password": { points: 3, duration: 3600 }, // FR-AUTH-042 — POST /request-password-reset
};

export async function consumeIpLimit(group: IpLimitGroup, ip: string): Promise<ConsumeResult> {
  const config = IP_LIMIT_CONFIG[group];
  return consume(`ip:${group}`, ip, config.points, config.duration);
}

// Test-only: clears every limiter's in-process state between tests so
// Supertest suites sharing one loopback IP/one fixture email don't bleed
// rate-limit state across `it` blocks. Wired globally in vitest.setup.ts.
export function resetAllRateLimiters(): void {
  limiters.clear();
}
