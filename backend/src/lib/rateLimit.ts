import Redis from "ioredis";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { env } from "@/config/env";

// Issue #145/M3.7 (FR-AUTH-040–044). Two independent consumers share this
// file:
//
// 1. Better Auth's own native per-request rate limiter (wired in lib/auth.ts
//    via `betterAuth({rateLimit: {customStorage: nativeIpRateLimitStorage,
//    customRules: {...}}})`) — Better Auth already resolves the real client
//    IP (advanced.ipAddress, honoring x-forwarded-for) and applies its rules
//    atomically before any route handler runs; this file only supplies the
//    Redis-backed storage and this issue's own per-path window/max values.
//    That native system has no per-email dimension at all.
// 2. `consumeEmailLimit`, called directly from lib/auth.ts's own
//    `hooks.before` chain (see enforceEmailRateLimits) for the endpoints
//    whose request body actually carries an email — the "per email" half of
//    FR-AUTH-040/042/043 that Better Auth's native system can't provide.
//
// Both funnel through the same generic `consume()` so there's one Redis
// client and one library in this file, not two different rate-limiting
// styles.

const isTestEnv = env.NODE_ENV === "test";

// Vitest's injected REDIS_URL (vitest.config.ts) is a dummy value with
// nothing listening on it — never actually connect to it.
const redisClient = isTestEnv ? null : new Redis(env.REDIS_URL);

// Better Auth's native rate limiter calls customStorage.consume(key, rule)
// with a *dynamic* {window, max} per matched path (see resolveRateLimitConfig
// in better-auth's own rate-limiter), so limiter instances are created
// lazily per distinct (keyPrefix, points, duration) triple rather than
// one-per-path up front. consumeEmailLimit's four groups also go through
// this same cache, keyed by their own fixed values.
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

// Bridge for betterAuth({rateLimit: {customStorage}}) — see lib/auth.ts.
// `key` already includes the path (Better Auth's own `createRateLimitKey`
// joins ip+path before calling this), so one keyPrefix is enough here.
export const nativeIpRateLimitStorage = {
  consume: (key: string, rule: { window: number; max: number }): Promise<ConsumeResult> =>
    consume("auth-ip", key, rule.max, rule.window),
};

export type EmailLimitGroup =
  | "admin-signin"
  | "admin-forgot-password"
  | "buyer-otp-request";

const EMAIL_LIMIT_CONFIG: Record<EmailLimitGroup, { points: number; duration: number }> = {
  // FR-AUTH-040 — admin sign-in, per email. Shares its threshold with the
  // native IP-keyed rule on the same path (lib/auth.ts's customRules); the
  // /two-factor/verify-otp leg of this same named limit has no email in its
  // request body (just {code}) and stays IP-only via the native system —
  // documented, accepted scope, same treatment this codebase gives other
  // infra-shaped gaps.
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

// Test-only: clears every limiter's in-process state between tests so
// Supertest suites sharing one loopback IP/one fixture email don't bleed
// rate-limit state across `it` blocks. Wired globally in vitest.setup.ts.
export function resetAllRateLimiters(): void {
  limiters.clear();
}
