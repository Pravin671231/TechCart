import IORedis from "ioredis";
import { Queue } from "bullmq";
import { env } from "@/config/env";

// M5 / Issue #156 — this codebase's first background-job subsystem. BullMQ
// has no in-memory fallback (unlike rateLimit.ts's RateLimiterMemory) — it
// needs a real Redis connection. When REDIS_URL is unset (local dev/CI
// without Redis) or under test, the whole subsystem disables itself rather
// than crashing the backend: every queue below is null, and enqueueing
// becomes a logged no-op. Mirrors the RATE_LIMITING_ENABLED/optional-
// REDIS_URL precedent (PR #284) exactly. Production's render.yaml sets
// REDIS_URL, so this only ever affects environments that don't have Redis.
const isTestEnv = env.NODE_ENV === "test";

// BullMQ requires maxRetriesPerRequest: null on the connection it's given —
// distinct from rateLimit.ts's own ioredis client, which doesn't set this
// and shouldn't be shared with BullMQ's blocking commands.
export const connection =
  !isTestEnv && env.REDIS_URL ? new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }) : null;

let warned = false;
export function warnQueueDisabledOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    "[queue] REDIS_URL is not set — background jobs (order auto-cancel sweep, notification emails) are disabled. Set REDIS_URL to enable them.",
  );
}

export const QUEUE_NAMES = {
  ORDER_LIFECYCLE: "order-lifecycle",
  ORDER_NOTIFICATIONS: "order-notifications",
} as const;

export const orderLifecycleQueue = connection
  ? new Queue(QUEUE_NAMES.ORDER_LIFECYCLE, { connection })
  : null;

// Populated with processors by #159/M5.6 — declared here now so both issues
// share one queue definition rather than #159 re-deriving the enable/
// disable guard.
export const orderNotificationsQueue = connection
  ? new Queue(QUEUE_NAMES.ORDER_NOTIFICATIONS, { connection })
  : null;
