import { afterEach } from "vitest";
import { resetAllRateLimiters } from "@/lib/rateLimit";

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
