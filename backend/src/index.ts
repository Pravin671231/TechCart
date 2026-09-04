import { connectDB } from "./config/db";
import { env } from "./config/env";
import app from "./app";
import { startQueueWorkers } from "./lib/queueWorkers";

export async function startServer(): Promise<void> {
  try {
    await connectDB();
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
    return;
  }

  app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
  });

  // In-process BullMQ worker (order auto-cancel sweep, #156; order
  // notification emails, #159) — no separate Render service. A no-op
  // when REDIS_URL isn't set (see lib/queue.ts). Caught separately from
  // connectDB()/app.listen() above: a runtime failure here (e.g. the queue
  // provider rejecting a scheduler call) must not take down an already-
  // listening HTTP server — only a DB-connection failure is fatal.
  try {
    await startQueueWorkers();
  } catch (error) {
    console.error("Error starting background queue workers — continuing without them:", error);
  }
}

if (require.main === module) {
  startServer();
}
