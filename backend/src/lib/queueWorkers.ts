import { Worker } from "bullmq";
import { runAutoCancelSweep } from "@/modules/orders/orders.service";
import { connection, orderLifecycleQueue, QUEUE_NAMES, warnQueueDisabledOnce } from "./queue";

// FR-ORD-010 — the auto-cancel sweep runs as a BullMQ job scheduler
// (bullmq@6's replacement for the old add({repeat}) API), upserted once at
// worker startup. upsertJobScheduler is idempotent on jobSchedulerId, so a
// process restart updates the existing schedule instead of stacking
// duplicates.
const AUTO_CANCEL_SWEEP_JOB = "auto-cancel-sweep";
const AUTO_CANCEL_SWEEP_INTERVAL_MS = 5 * 60_000;

// In-process worker (no separate Render service) — started from index.ts
// after connectDB() succeeds, alongside app.listen. Silently does nothing
// when the queue subsystem is disabled (see queue.ts).
export async function startQueueWorkers(): Promise<void> {
  if (!connection || !orderLifecycleQueue) {
    warnQueueDisabledOnce();
    return;
  }

  new Worker(
    QUEUE_NAMES.ORDER_LIFECYCLE,
    async (job) => {
      if (job.name === AUTO_CANCEL_SWEEP_JOB) {
        await runAutoCancelSweep();
      }
    },
    { connection },
  );

  await orderLifecycleQueue.upsertJobScheduler(AUTO_CANCEL_SWEEP_JOB, {
    every: AUTO_CANCEL_SWEEP_INTERVAL_MS,
  });
}
