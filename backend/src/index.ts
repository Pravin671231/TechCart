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
    //
    // The unwrap below has to handle two different shapes for the same
    // `import("./app.js")` call: under Vitest/tsx (both ESM-native module
    // loaders) it resolves in one level, exactly like a static `import`.
    // But this package compiles to CommonJS (`"type": "commonjs"`), and in
    // the real compiled build Node's ESM loader wraps a CommonJS module's
    // `module.exports` as `namespace.default` verbatim — so `.default` there
    // is actually `{ default: app }` (the whole `exports` object
    // TypeScript's esModuleInterop produces), not `app` itself, leaving
    // `app.listen` undefined. This broke `node dist/src/index.js` (what
    // Render runs) while every dev/test path stayed silently correct.
    const appModule = await import("./app.js");
    const candidate = (appModule as unknown as { default: unknown }).default as
      | Express
      | { default: Express };
    const app: Express =
      "listen" in candidate ? candidate : candidate.default;

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
