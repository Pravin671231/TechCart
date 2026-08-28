import { connectDB } from "./config/db";
import { env } from "./config/env";
import app from "./app";
import { startQueueWorkers } from "./lib/queueWorkers";

export async function startServer(): Promise<void> {
  try {
    await connectDB();

    app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`);
    });

    // In-process BullMQ worker (order auto-cancel sweep, #156; order
    // notification emails, #159) — no separate Render service. A no-op
    // when REDIS_URL isn't set (see lib/queue.ts).
    await startQueueWorkers();
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
