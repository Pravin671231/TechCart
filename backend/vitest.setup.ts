import { afterEach } from "vitest";
// Relative import, not the `@/*` alias every other file in this workspace
// uses — confirmed via a real CI failure that vite-tsconfig-paths doesn't
// resolve path aliases for Vitest's `setupFiles` the way it does for actual
// test files, so `@/lib/rateLimit` here throws a raw Node
// ERR_MODULE_NOT_FOUND before any test even runs.
import { resetAllRateLimiters } from "./src/lib/rateLimit";

// Issue #145/M3.7 — without this, rate-limiter state (an in-process
// RateLimiterMemory singleton under NODE_ENV=test) persists for the whole
// life of a test file's worker. Every suite that repeatedly signs in with
// the same fixture email/loopback IP (admin-sign-in, auth, adminUsers,
// account, ...) would otherwise start legitimately tripping these new
// limits mid-file. Resetting after every test, globally, is simpler and
// safer than hunting down and patching each affected existing suite.
afterEach(() => {
  resetAllRateLimiters();
});
