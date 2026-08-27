import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { requestOtp, verifyOtp } from "@/lib/otp";

let mongod: MongoMemoryServer;

// Static imports are safe here for the same reason as session.test.ts —
// this module never reads env.MONGODB_URI, and vitest.config.ts already
// injects every var env.ts's schema requires for the whole run.
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.db!.collection("otps").deleteMany({});
});

describe("otp", () => {
  it("issues a code that verifies successfully", async () => {
    const code = await requestOtp("buyer@example.com", "buyer-sign-in");

    const result = await verifyOtp("buyer@example.com", "buyer-sign-in", code);

    expect(result).toEqual({ ok: true });
  });

  it("rejects a wrong code", async () => {
    await requestOtp("buyer@example.com", "buyer-sign-in");

    const result = await verifyOtp("buyer@example.com", "buyer-sign-in", "000000");

    expect(result).toEqual({ ok: false, reason: "invalid_otp" });
  });

  it("rejects a reused code", async () => {
    const code = await requestOtp("buyer@example.com", "buyer-sign-in");
    await verifyOtp("buyer@example.com", "buyer-sign-in", code);

    const result = await verifyOtp("buyer@example.com", "buyer-sign-in", code);

    expect(result).toEqual({ ok: false, reason: "invalid_otp" });
  });

  it("rejects an expired code", async () => {
    const code = await requestOtp("buyer@example.com", "buyer-sign-in");
    await mongoose.connection
      .db!.collection("otps")
      .updateOne({ email: "buyer@example.com" }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const result = await verifyOtp("buyer@example.com", "buyer-sign-in", code);

    expect(result).toEqual({ ok: false, reason: "otp_expired" });
  });

  it("keeps purposes independent — a buyer-sign-in code doesn't verify under admin-2fa", async () => {
    const code = await requestOtp("admin@example.com", "buyer-sign-in");

    const result = await verifyOtp("admin@example.com", "admin-2fa", code);

    expect(result).toEqual({ ok: false, reason: "invalid_otp" });
  });

  it("keeps emails independent — one email's code doesn't verify for another", async () => {
    const code = await requestOtp("buyer-a@example.com", "buyer-sign-in");

    const result = await verifyOtp("buyer-b@example.com", "buyer-sign-in", code);

    expect(result).toEqual({ ok: false, reason: "invalid_otp" });
  });
});
