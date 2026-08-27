import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { consumeEmailLimit, consumeIpLimit, resetAllRateLimiters } from "@/lib/rateLimit";

// Issue #145/M3.7 — exercises consumeEmailLimit directly. NODE_ENV=test (set
// globally by Vitest) makes this module select RateLimiterMemory internally,
// so this is real sliding-window logic, not a mock, with zero live Redis
// needed.
describe("rateLimit", () => {
  afterEach(() => {
    resetAllRateLimiters();
  });

  it("allows requests up to the configured point count, then rejects", async () => {
    const email = "unit-test@example.com";
    for (let i = 0; i < 5; i++) {
      const result = await consumeEmailLimit("admin-signin", email);
      expect(result.allowed).toBe(true);
    }
    const sixth = await consumeEmailLimit("admin-signin", email);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfter).toBeGreaterThan(0);
  });

  it("tracks separate groups independently for the same email", async () => {
    const email = "unit-test-2@example.com";
    for (let i = 0; i < 5; i++) {
      await consumeEmailLimit("admin-signin", email);
    }
    const otherGroup = await consumeEmailLimit("buyer-otp-request", email);
    expect(otherGroup.allowed).toBe(true);
  });

  it("resetAllRateLimiters clears prior consumption", async () => {
    const email = "unit-test-3@example.com";
    for (let i = 0; i < 5; i++) {
      await consumeEmailLimit("admin-signin", email);
    }
    resetAllRateLimiters();
    const result = await consumeEmailLimit("admin-signin", email);
    expect(result.allowed).toBe(true);
  });

  it("is a no-op for every limiter when RATE_LIMITING_ENABLED is false", async () => {
    // `env` is a plain mutable object; `consume()` reads the flag live, so
    // flipping it here needs no module reset. Restored in the finally block.
    const previous = env.RATE_LIMITING_ENABLED;
    env.RATE_LIMITING_ENABLED = false;
    try {
      for (let i = 0; i < 20; i++) {
        expect((await consumeEmailLimit("admin-signin", "off@example.com")).allowed).toBe(true);
        expect((await consumeIpLimit("admin-signin", "203.0.113.7")).allowed).toBe(true);
      }
    } finally {
      env.RATE_LIMITING_ENABLED = previous;
    }
  });
});
