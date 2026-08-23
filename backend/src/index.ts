import type { Express } from "express";
import { connectDB } from "./config/db";
import { env } from "./config/env";

export async function startServer(): Promise<void> {
  try {
    await connectDB();

    // Dynamic import so `./app` (and everything it pulls in transitively,
    // including src/lib/auth.ts's mongodbAdapter(mongoose.connection.db!, ...))
    // is only evaluated after the DB connection is open — a static top-level
    // import here would freeze auth.ts's mongo adapter on an undefined `db`,
    // since imports resolve before this function body ever runs connectDB().
    const appModule = await import("./app.js");
    const app = (appModule as unknown as { default: Express }).default;

    app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
