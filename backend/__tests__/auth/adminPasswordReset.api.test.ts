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
  sendResetPasswordEmail: vi.fn().mockResolvedValue(undefined),
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
  await mongoose.connection.db!.collection("verification").deleteMany({});
});

afterEach(() => {
  vi.clearAllMocks();
});

const ADMIN_PASSWORD = "correct-horse-battery-staple";
const NEW_PASSWORD = "new-correct-horse-battery-staple";

async function seedAdmin(email: string, password = ADMIN_PASSWORD) {
  const userId = new mongoose.Types.ObjectId();
  await mongoose.connection.db!.collection("users").insertOne({
    _id: userId,
    name: "Admin",
    email,
    emailVerified: true,
    role: "super-admin",
    status: true,
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

async function seedBuyer(email: string) {
  await mongoose.connection.db!.collection("users").insertOne({
    _id: new mongoose.Types.ObjectId(),
    name: "Buyer",
    email,
    emailVerified: true,
    role: "buyer",
    status: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function requestResetAndGetToken(email: string) {
  const res = await request(app).post("/api/auth/request-password-reset").send({ email });
  const { sendResetPasswordEmail } = await import("../../src/externalService/resend.js");
  const token = (sendResetPasswordEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as
    string | undefined;
  return { res, token };
}

describe("Admin password reset", () => {
  describe("POST /api/auth/request-password-reset", () => {
    it("returns an identical response for a registered admin, an unregistered email, and a buyer email", async () => {
      await seedAdmin("admin1@example.com");
      await seedBuyer("buyer1@example.com");

      const adminRes = await request(app)
        .post("/api/auth/request-password-reset")
        .send({ email: "admin1@example.com" });
      const buyerRes = await request(app)
        .post("/api/auth/request-password-reset")
        .send({ email: "buyer1@example.com" });
      const unknownRes = await request(app)
        .post("/api/auth/request-password-reset")
        .send({ email: "no-such-person@example.com" });

      expect(adminRes.status).toBe(200);
      expect(adminRes.body).toEqual(buyerRes.body);
      expect(adminRes.body).toEqual(unknownRes.body);
      expect(adminRes.body).toMatchObject({
        success: true,
        data: { status: true },
      });
    });

    it("only actually sends an email for the registered admin", async () => {
      await seedAdmin("admin2@example.com");
      await seedBuyer("buyer2@example.com");
      const { sendResetPasswordEmail } = await import("../../src/externalService/resend.js");

      await request(app)
        .post("/api/auth/request-password-reset")
        .send({ email: "buyer2@example.com" });
      await request(app)
        .post("/api/auth/request-password-reset")
        .send({ email: "no-such-person@example.com" });
      expect(sendResetPasswordEmail).not.toHaveBeenCalled();

      await request(app)
        .post("/api/auth/request-password-reset")
        .send({ email: "admin2@example.com" });
      expect(sendResetPasswordEmail).toHaveBeenCalledTimes(1);
      expect(sendResetPasswordEmail).toHaveBeenCalledWith("admin2@example.com", expect.any(String));
    });

    it("creates no verification record for a buyer email", async () => {
      await seedBuyer("buyer3@example.com");

      await request(app)
        .post("/api/auth/request-password-reset")
        .send({ email: "buyer3@example.com" });

      const count = await mongoose.connection
        .db!.collection("verification")
        .countDocuments({ identifier: { $regex: "^reset-password:" } });
      expect(count).toBe(0);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("resets the password with a valid token and invalidates existing sessions", async () => {
      await seedAdmin("reset1@example.com");
      const { token } = await requestResetAndGetToken("reset1@example.com");
      expect(token).toBeTruthy();

      // Establish a session with the old password first, to prove reset
      // invalidates it (FR-AUTH-022).
      const oldSignIn = await request(app)
        .post("/api/auth/admin/sign-in")
        .send({ email: "reset1@example.com", password: ADMIN_PASSWORD });
      const { sendOtpEmail } = await import("../../src/externalService/resend.js");
      const oldOtp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
      const oldAgent = request.agent(app);
      await oldAgent
        .post("/api/auth/admin/verify-otp")
        .send({ challenge: oldSignIn.body.data.challenge, otp: oldOtp });

      const resetRes = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, newPassword: NEW_PASSWORD });
      expect(resetRes.status).toBe(200);
      expect(resetRes.body).toMatchObject({ success: true, data: { status: true } });

      // Old session is gone.
      const oldSessionRes = await oldAgent.get("/api/auth/get-session");
      expect(oldSessionRes.status).toBe(200);
      expect(oldSessionRes.body.data).toBeNull();

      // Old password no longer works; new password does.
      const oldPasswordRes = await request(app)
        .post("/api/auth/admin/sign-in")
        .send({ email: "reset1@example.com", password: ADMIN_PASSWORD });
      expect(oldPasswordRes.status).toBe(401);

      const newPasswordRes = await request(app)
        .post("/api/auth/admin/sign-in")
        .send({ email: "reset1@example.com", password: NEW_PASSWORD });
      expect(newPasswordRes.status).toBe(200);
      expect(newPasswordRes.body.data.challenge).toBeTruthy();
    });

    it("rejects an expired token", async () => {
      const userId = await seedAdmin("reset2@example.com");
      const token = "expired-token-value";
      await mongoose.connection.db!.collection("verification").insertOne({
        _id: new mongoose.Types.ObjectId(),
        identifier: `reset-password:${token}`,
        value: userId.toString(),
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, newPassword: NEW_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "INVALID_TOKEN" });
    });

    it("rejects a reused token", async () => {
      await seedAdmin("reset3@example.com");
      const { token } = await requestResetAndGetToken("reset3@example.com");

      const first = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, newPassword: NEW_PASSWORD });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, newPassword: "yet-another-password" });
      expect(second.status).toBe(400);
      expect(second.body).toMatchObject({ success: false, code: "INVALID_TOKEN" });
    });
  });
});
