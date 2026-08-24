import { afterEach } from "vitest";

// Issue #145/M3.7 — without this, rate-limiter state (an in-process
// RateLimiterMemory singleton under NODE_ENV=test) persists for the whole
// life of a test file's worker. Every suite that repeatedly signs in with
// the same fixture email/loopback IP (admin-sign-in, auth, adminUsers,
// account, ...) would otherwise start legitimately tripping these new
// limits mid-file. Resetting after every test, globally, is simpler and
// safer than hunting down and patching each affected existing suite.
//
// The import is dynamic, INSIDE the callback, not a static top-level one —
// confirmed via a real CI failure that a static import here forces
// @/config/env's module-level `envSchema.parse(process.env)` to run as part
// of this setup file's own evaluation, which happens *before* a test file's
// own beforeAll gets a chance to set `process.env.MONGODB_URI` to its real
// mongodb-memory-server URI. That froze every mongo-dependent suite's
// env.MONGODB_URI on vitest.config.ts's injected default
// ("mongodb://localhost:27017/...") for the rest of that worker's life,
// producing ECONNREFUSED ...:27017 across every one of them regardless of
// what port their own MongoMemoryServer instance actually bound to. A
// dynamic import here defers that first evaluation until after the first
// test's own beforeAll/imports have already run and cached the correct
// value — this relative-path import already established (not the `@/*`
// alias, which vite-tsconfig-paths doesn't resolve for setupFiles).
afterEach(async () => {
  const { resetAllRateLimiters } = await import("./src/lib/rateLimit");
  resetAllRateLimiters();
});
