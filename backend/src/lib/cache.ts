import Redis from "ioredis";
import { env } from "@/config/env";

// Issue #171/M7.1 (FR-DASH-013/014) — a small get-or-set cache for dashboard
// aggregations, with the identical env-gating shape rateLimit.ts's own Redis
// client already uses: a real Redis client only when we're not under test
// and a REDIS_URL is actually configured, otherwise every call falls back to
// an in-process Map. Its own independent client instance, not a shared one —
// matching how r2.ts/mailer.ts/razorpay.ts/rateLimit.ts each construct their
// own external client rather than sharing one global instance.
const isTestEnv = env.NODE_ENV === "test";

const redisClient = !isTestEnv && env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

type MemoryEntry = { value: string; expiresAt: number };
const memoryStore = new Map<string, MemoryEntry>();

function readMemory(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function writeMemory(key: string, value: string, ttlSeconds: number): void {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// TTL-only invalidation (FR-DASH-014) — nothing ever explicitly busts a key;
// a stale value simply expires. Resilient to a transient Redis error: falls
// through to computing fresh rather than throwing, the same defensive
// posture rateLimit.ts's own insuranceLimiter gives a Redis outage.
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  if (redisClient) {
    try {
      const cached = await redisClient.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // fall through to compute() below
    }
  } else {
    const cached = readMemory(key);
    if (cached !== null) return JSON.parse(cached) as T;
  }

  const value = await compute();
  const serialized = JSON.stringify(value);

  if (redisClient) {
    try {
      await redisClient.setex(key, ttlSeconds, serialized);
    } catch {
      // best-effort — a failed write just means the next call recomputes
    }
  } else {
    writeMemory(key, serialized, ttlSeconds);
  }

  return value;
}

// Test-only: clears in-process cache state between tests, mirroring
// rateLimit.ts's resetAllRateLimiters() precedent.
export function resetDashboardCache(): void {
  memoryStore.clear();
}
