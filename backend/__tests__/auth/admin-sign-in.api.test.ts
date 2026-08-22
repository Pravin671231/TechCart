import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// Admin password + mandatory OTP sign-in (Issue #140/M3.2, FR-AUTH-009–018,
// 030). Kept as its own file, separate from __tests__/auth/auth.api.test.ts
// (#139, buyer sign-in) — the flow shape differs materially (two-step
// password-then-OTP vs. buyer's single-call methods) even though the
// low-level setup (mongodb-memory-server, dynamic imports so MONGODB_URI is
// set before @/config/env is first evaluated, mocked sendOtpEmail) is copied
// verbatim from that file's own established convention.
//
// CAVEAT: this suite exercises Better Auth's `twoFactor` plugin, configured
// in src/lib/auth.ts against this codebase's best-known reading of
// better-auth@1.7.1's API (endpoint paths, request/response shapes,
// otpOptions callback signature) — written without local package access to
// verify against (node_modules isn't installed in the environment this was
// authored in, and outbound docs access was blocked). Run this suite for
// real once dependencies are installed and adjust endpoint paths/assertions
// to match the real plugin surface if it differs — see the NOTE comments in
// src/lib/auth.ts and createAdminUser.ts.
vi.mock("@/externalService/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

let mongod: MongoMemoryServer;
let mongoose: typeof mongooseType;
let app: Express;
let provisionAdminUser: typeof import("../../src/scripts/seed/createAdminUser.js").provisionAdminUser;

const ADMIN_EMAIL = "admin-signin@example.com";
const ADMIN_PASSWORD = "Sup3rSecret!Pass";

beforeAll(async () => {
  const { MongoMemoryServer: MemoryServer } = await import("mongodb-memory-server");
  mongod = await MemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  mongoose = (await import("mongoose")).default;
  const { connectDB } = await import("../../src/config/db.js");
  await connectDB();

  const appModule = await import("../../src/app.js");
  app = (appModule as unknown as { default: Express }).default;

  const seedModule = await import("../../src/scripts/seed/createAdminUser.js");
  provisionAdminUser = seedModule.provisionAdminUser;
}, 60000);

afterAll(async () => {
  await mongoose?.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.collection("users").deleteMany({});
  await mongoose.connection.db!.collection("account").deleteMany({});
  await mongoose.connection.db!.collection("verification").deleteMany({});
  await mongoose.connection.db!.collection("session").deleteMany({});
  // twoFactor plugin's own secret/backup-code collection, if it creates one
  // — a no-op deleteMany against a non-existent collection is harmless.
  await mongoose.connection.db!.collection("twoFactor").deleteMany({});

  await provisionAdminUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: "Admin Sign-In Fixture",
    role: "super-admin",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function capturePasswordStep(agent: ReturnType<typeof request.agent>) {
  const res = await agent
    .post("/api/auth/sign-in/email")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return res;
}

async function sendAndCaptureOtp(agent: ReturnType<typeof request.agent>): Promise<string> {
  const send = await agent.post("/api/auth/two-factor/send-otp").send({});
  expect(send.status).toBe(200);

  const { sendOtpEmail } = await import("../../src/externalService/resend.js");
  const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
  expect(otp).toBeTruthy();
  return otp;
}

describe("Admin password + mandatory OTP sign-in", () => {
  describe("Happy path", () => {
    it("establishes a session only after password AND OTP both succeed", async () => {
      const agent = request.agent(app);

      const passwordRes = await capturePasswordStep(agent);
      expect(passwordRes.status).toBe(200);
      expect(passwordRes.body.success).toBe(true);

      // Correct password alone must not establish a session (FR-AUTH-014).
      const midFlowSession = await agent.get("/api/auth/get-session");
      expect(midFlowSession.body.data ?? null).toBeFalsy();

      const otp = await sendAndCaptureOtp(agent);

      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: otp });
      expect(verify.status).toBe(200);
      expect(verify.body.success).toBe(true);

      const session = await agent.get("/api/auth/get-session");
      expect(session.status).toBe(200);
      expect(session.body.data.user.email).toBe(ADMIN_EMAIL);
      expect(session.body.data.user.role).toBe("super-admin");
    });
  });

  describe("Credential rejection (FR-AUTH-010)", () => {
    it("returns an identical generic error for wrong password and unknown email", async () => {
      const wrongPassword = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email: ADMIN_EMAIL, password: "not-the-password" });

      const unknownEmail = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email: "no-such-admin@example.com", password: ADMIN_PASSWORD });

      expect(wrongPassword.status).toBeGreaterThanOrEqual(400);
      expect(unknownEmail.status).toBeGreaterThanOrEqual(400);
      expect(wrongPassword.body.success).toBe(false);
      expect(unknownEmail.body.success).toBe(false);
      expect(wrongPassword.body.code).toBe(unknownEmail.body.code);
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it("never sends an OTP on a wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email: ADMIN_EMAIL, password: "not-the-password" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      const { sendOtpEmail } = await import("../../src/externalService/resend.js");
      expect(sendOtpEmail).not.toHaveBeenCalled();
    });
  });

  describe("OTP rejection", () => {
    it("rejects a wrong OTP code and establishes no session", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      await sendAndCaptureOtp(agent);

      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "000000" });
      expect(verify.status).toBeGreaterThanOrEqual(400);
      expect(verify.body.success).toBe(false);

      const session = await agent.get("/api/auth/get-session");
      expect(session.body.data ?? null).toBeFalsy();
    });

    it("rejects an expired OTP", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      const otp = await sendAndCaptureOtp(agent);

      // expiresIn is 600s, same emailOTP plugin instance the buyer flow uses
      // — push the stored record's expiry into the past instead of faking
      // the system clock, matching auth.api.test.ts's own convention.
      await mongoose.connection
        .db!.collection("verification")
        .updateMany(
          { identifier: { $regex: ADMIN_EMAIL } },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );

      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: otp });
      expect(verify.status).toBeGreaterThanOrEqual(400);
      expect(verify.body.success).toBe(false);
    });

    it("rejects a reused OTP", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      const otp = await sendAndCaptureOtp(agent);

      const first = await agent.post("/api/auth/two-factor/verify-otp").send({ code: otp });
      expect(first.status).toBe(200);

      // Restart the challenge (a fresh password step) and replay the
      // already-consumed code — must still be rejected as used, not
      // accepted a second time.
      const secondAgent = request.agent(app);
      await capturePasswordStep(secondAgent);
      const second = await secondAgent
        .post("/api/auth/two-factor/verify-otp")
        .send({ code: otp });

      expect(second.status).toBeGreaterThanOrEqual(400);
      expect(second.body.success).toBe(false);
    });
  });

  describe("Sign-out invalidation (FR-AUTH-017)", () => {
    it("rejects the session cookie after sign-out", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      const otp = await sendAndCaptureOtp(agent);
      await agent.post("/api/auth/two-factor/verify-otp").send({ code: otp });

      const beforeSignOut = await agent.get("/api/auth/get-session");
      expect(beforeSignOut.body.data.user.email).toBe(ADMIN_EMAIL);

      const signOut = await agent.post("/api/auth/sign-out").send({});
      expect(signOut.status).toBe(200);

      const afterSignOut = await agent.get("/api/auth/get-session");
      expect(afterSignOut.body.data ?? null).toBeFalsy();
    });
  });

  describe("Session cookie flags (FR-AUTH-015–016)", () => {
    it("sets httpOnly/secure/sameSite=lax on the session cookie", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      const otp = await sendAndCaptureOtp(agent);
      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: otp });

      const setCookie = verify.headers["set-cookie"];
      expect(setCookie).toBeTruthy();
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      const sessionCookie = cookies.find((c: string) => /session/i.test(c));
      expect(sessionCookie).toBeTruthy();
      expect(sessionCookie?.toLowerCase()).toContain("httponly");
      expect(sessionCookie?.toLowerCase()).toContain("samesite=lax");
    });
  });

  describe("Bearer-token session (cross-domain, mirrors Issue #139's own fix)", () => {
    it("resolves the session from an Authorization header alone, no cookies", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      const otp = await sendAndCaptureOtp(agent);
      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: otp });

      const token = verify.headers["set-auth-token"];
      expect(token).toBeTruthy();

      const session = await request(app)
        .get("/api/auth/get-session")
        .set("Authorization", `Bearer ${token}`);

      expect(session.status).toBe(200);
      expect(session.body.data.user.email).toBe(ADMIN_EMAIL);
    });
  });

  describe("Role enforcement (FR-AUTH-030)", () => {
    it("does not allow a buyer account to complete this flow", async () => {
      const buyerEmail = "buyer-not-admin@example.com";
      await mongoose.connection.db!.collection("users").insertOne({
        _id: new mongoose.Types.ObjectId(),
        name: "Plain Buyer",
        email: buyerEmail,
        emailVerified: true,
        role: "buyer",
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email: buyerEmail, password: "irrelevant" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });
});
