import { afterEach, describe, expect, it } from "vitest";
import { consumeEmailLimit, nativeIpRateLimitStorage, resetAllRateLimiters } from "@/lib/rateLimit";

// Issue #145/M3.7 — exercises consumeEmailLimit/nativeIpRateLimitStorage
// directly. NODE_ENV=test (set globally by Vitest) makes this module select
// RateLimiterMemory internally, so this is real sliding-window logic, not a
// mock, with zero live Redis needed.
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

  it("nativeIpRateLimitStorage.consume matches Better Auth's customStorage contract", async () => {
    const result = await nativeIpRateLimitStorage.consume("127.0.0.1|/sign-in/email", {
      window: 900,
      max: 2,
    });
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeNull();
  });
});
