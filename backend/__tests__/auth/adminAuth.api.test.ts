import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "@better-auth/core/db";
import type { Express } from "express";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// Same real-MongoDB rationale and dynamic-import-after-env-mutation pattern
// as __tests__/auth/auth.api.test.ts — see that file's header comment.
vi.mock("@/externalService/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

let mongod: MongoMemoryReplSet;
let mongoose: typeof mongooseType;
let app: Express;

beforeAll(async () => {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongod.getUri();

  mongoose = (await import("mongoose")).default;
  const { connectDB } = await import("../../src/config/db.js");
  await connectDB();

  const appModule = await import("../../src/app.js");
  app = (appModule as unknown as { default: Express }).default;
}, 60000);

afterAll(async () => {
  await mongoose?.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.collection("users").deleteMany({});
  await mongoose.connection.db!.collection("account").deleteMany({});
  await mongoose.connection.db!.collection("session").deleteMany({});
  await mongoose.connection.db!.collection("adminSignInChallenges").deleteMany({});
});

afterEach(() => {
  vi.clearAllMocks();
});

const ADMIN_PASSWORD = "correct-horse-battery-staple";

async function seedAdmin(
  email: string,
  { role = "super-admin", status = true, password = ADMIN_PASSWORD } = {},
) {
  const userId = new mongoose.Types.ObjectId();
  await mongoose.connection.db!.collection("users").insertOne({
    _id: userId,
    name: "Admin",
    email,
    emailVerified: true,
    role,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await mongoose.connection.db!.collection("account").insertOne({
    _id: new mongoose.Types.ObjectId(),
    userId,
    providerId: "credential",
    issuer: createLocalAccountIssuer("credential"),
    accountId: userId.toString(),
    password: await hashPassword(password),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return userId;
}

async function signInAndGetOtp(email: string, password = ADMIN_PASSWORD) {
  const res = await request(app).post("/api/auth/admin/sign-in").send({ email, password });
  const { sendOtpEmail } = await import("../../src/externalService/resend.js");
  const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
  return { res, otp };
}

describe("Admin password + mandatory OTP sign-in", () => {
  describe("POST /api/auth/admin/sign-in", () => {
    it("issues a challenge on correct credentials without establishing a session", async () => {
      await seedAdmin("admin1@example.com");

      const res = await request(app)
        .post("/api/auth/admin/sign-in")
        .send({ email: "admin1@example.com", password: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.challenge).toBeTruthy();
      expect(res.body.data.expiresInSeconds).toBe(600);
      expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("rejects an unknown email and a wrong password identically", async () => {
      await seedAdmin("admin2@example.com");

      const unknown = await request(app)
        .post("/api/auth/admin/sign-in")
        .send({ email: "no-such-admin@example.com", password: "whatever" });
      const wrongPassword = await request(app)
        .post("/api/auth/admin/sign-in")
        .send({ email: "admin2@example.com", password: "wrong-password" });

      expect(unknown.status).toBe(401);
      expect(wrongPassword.status).toBe(401);
      expect(unknown.body).toEqual(wrongPassword.body);
      expect(unknown.body).toMatchObject({ success: false, code: "INVALID_CREDENTIALS" });
    });

    it("rejects a buyer email (no password credential exists)", async () => {
      await mongoose.connection.db!.collection("users").insertOne({
        _id: new mongoose.Types.ObjectId(),
        name: "Buyer",
        email: "buyer@example.com",
        emailVerified: true,
        role: "buyer",
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/auth/admin/sign-in")
        .send({ email: "buyer@example.com", password: "irrelevant" });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: "INVALID_CREDENTIALS" });
    });

    it("rejects a deactivated admin account", async () => {
      await seedAdmin("deactivated@example.com", { status: false });

      const res = await request(app)
        .post("/api/auth/admin/sign-in")
        .send({ email: "deactivated@example.com", password: ADMIN_PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: "INVALID_CREDENTIALS" });
    });
  });

  describe("POST /api/auth/admin/verify-otp", () => {
    it("completes the happy path: password then correct OTP establishes a session", async () => {
      await seedAdmin("happy@example.com");
      const { res: signInRes, otp } = await signInAndGetOtp("happy@example.com");
      const challenge = signInRes.body.data.challenge as string;

      const agent = request.agent(app);
      const verifyRes = await agent.post("/api/auth/admin/verify-otp").send({ challenge, otp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      const setCookie = verifyRes.headers["set-cookie"];
      expect(setCookie).toBeDefined();
      const cookieString = (setCookie as unknown as string[]).join(";");
      expect(cookieString).toMatch(/HttpOnly/i);
      expect(cookieString).toMatch(/SameSite=Lax/i);

      const sessionRes = await agent.get("/api/auth/get-session");
      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.data.user.email).toBe("happy@example.com");
    });

    it("rejects a wrong OTP without creating a session", async () => {
      await seedAdmin("wrongotp@example.com");
      const { res: signInRes } = await signInAndGetOtp("wrongotp@example.com");
      const challenge = signInRes.body.data.challenge as string;

      const res = await request(app)
        .post("/api/auth/admin/verify-otp")
        .send({ challenge, otp: "000000" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "OTP_INVALID" });
      expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("rejects an expired challenge", async () => {
      const userId = await seedAdmin("expired@example.com");
      await mongoose.connection.db!.collection("adminSignInChallenges").insertOne({
        _id: new mongoose.Types.ObjectId(),
        userId,
        otpHash: await hashPassword("123456"),
        expiresAt: new Date(Date.now() - 1000),
        consumedAt: null,
        createdAt: new Date(),
      });
      const challengeId = (
        await mongoose.connection.db!.collection("adminSignInChallenges").findOne({ userId })
      )?._id.toString();

      const res = await request(app)
        .post("/api/auth/admin/verify-otp")
        .send({ challenge: challengeId, otp: "123456" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "OTP_EXPIRED" });
    });

    it("rejects replaying an already-consumed challenge", async () => {
      await seedAdmin("reuse@example.com");
      const { res: signInRes, otp } = await signInAndGetOtp("reuse@example.com");
      const challenge = signInRes.body.data.challenge as string;

      const first = await request(app).post("/api/auth/admin/verify-otp").send({ challenge, otp });
      expect(first.status).toBe(200);

      const second = await request(app).post("/api/auth/admin/verify-otp").send({ challenge, otp });
      expect(second.status).toBe(400);
      expect(second.body).toMatchObject({ success: false, code: "OTP_EXPIRED" });
    });
  });

  describe("Neither step alone establishes a session (FR-AUTH-014)", () => {
    it("password step alone leaves the caller unauthenticated", async () => {
      await seedAdmin("password-only@example.com");
      const agent = request.agent(app);
      await agent
        .post("/api/auth/admin/sign-in")
        .send({ email: "password-only@example.com", password: ADMIN_PASSWORD });

      // Better Auth's own /get-session returns 200 with a null body for no
      // session (confirmed from its source — it never 401s here), so "no
      // session yet" is asserted on the body, not the status.
      const sessionRes = await agent.get("/api/auth/get-session");
      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.data).toBeNull();
    });
  });

  describe("POST /api/auth/sign-out", () => {
    it("invalidates the session server-side", async () => {
      await seedAdmin("signout@example.com");
      const { res: signInRes, otp } = await signInAndGetOtp("signout@example.com");
      const challenge = signInRes.body.data.challenge as string;

      const agent = request.agent(app);
      await agent.post("/api/auth/admin/verify-otp").send({ challenge, otp });

      const signOutRes = await agent.post("/api/auth/sign-out").send({});
      expect(signOutRes.status).toBe(200);

      const sessionRes = await agent.get("/api/auth/get-session");
      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.data).toBeNull();
    });
  });
});
