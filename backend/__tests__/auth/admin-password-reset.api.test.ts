import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// Admin self-service password reset (Issue #141/M3.3, FR-AUTH-019–022).
// Kept as its own file, separate from admin-sign-in.api.test.ts — same
// "materially different flow shape" precedent that file's own header
// comment set. Low-level setup (mongodb-memory-server, dynamic imports so
// MONGODB_URI is set before @/config/env is first evaluated) copied
// verbatim from that file's established convention.
//
// This suite exercises Better Auth's built-in emailAndPassword
// reset-password support, configured in src/lib/auth.ts. Endpoint paths and
// the sendResetPassword callback signature were originally written without
// local package access to verify against — both the issue/SRS's
// illustrative "/forgot-password" and the plausible-sounding
// "/forget-password" 404'd against real CI. A diagnostic logging
// Object.keys(auth.api) revealed the real method is `requestPasswordReset`
// (better-auth@1.7.1 apparently doesn't expose a link-based
// "forget"/"forgot" password method at all — only requestPasswordReset,
// requestPasswordResetEmailOTP, forgetPasswordEmailOTP for the OTP variant),
// which maps to POST /request-password-reset per the same camelCase ->
// kebab-case convention already confirmed for signInEmail -> /sign-in/email
// and getSession -> /get-session. /reset-password and the sendResetPassword
// callback signature both matched as originally written.
vi.mock("@/externalService/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

let mongod: MongoMemoryServer;
let mongoose: typeof mongooseType;
let app: Express;
let provisionAdminUser: typeof import("../../src/scripts/seed/createAdminUser.js").provisionAdminUser;

const ADMIN_EMAIL = "admin-reset@example.com";
const ADMIN_PASSWORD = "Sup3rSecret!Pass";
const NEW_PASSWORD = "AnotherSecret!456";

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
  await mongoose.connection.db!.collection("twoFactor").deleteMany({});
  await mongoose.connection.db!.collection("passwordresettokens").deleteMany({});

  await provisionAdminUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: "Admin Reset Fixture",
    role: "super-admin",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function insertBuyer(email: string) {
  await mongoose.connection.db!.collection("users").insertOne({
    _id: new mongoose.Types.ObjectId(),
    name: "Plain Buyer",
    email,
    emailVerified: true,
    role: "buyer",
    status: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function requestForgotPassword(email: string) {
  return request(app).post("/api/auth/request-password-reset").send({ email });
}

async function captureResetToken(): Promise<string> {
  const { sendPasswordResetEmail } = await import("../../src/externalService/resend.js");
  const url = (sendPasswordResetEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
  expect(url).toBeTruthy();
  const token = new URL(url).searchParams.get("token");
  expect(token).toBeTruthy();
  return token as string;
}

async function capturePasswordStep(agent: ReturnType<typeof request.agent>, password: string) {
  return agent.post("/api/auth/sign-in/email").send({ email: ADMIN_EMAIL, password });
}

async function signInFully(agent: ReturnType<typeof request.agent>, password: string) {
  const passwordRes = await capturePasswordStep(agent, password);
  expect(passwordRes.status).toBe(200);

  const send = await agent.post("/api/auth/two-factor/send-otp").send({});
  expect(send.status).toBe(200);

  const { sendOtpEmail } = await import("../../src/externalService/resend.js");
  const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
  expect(otp).toBeTruthy();

  return agent.post("/api/auth/two-factor/verify-otp").send({ code: otp });
}

describe("Admin password reset", () => {
  describe("No enumeration (FR-AUTH-019)", () => {
    it("returns an identical response for a registered admin and an unregistered email", async () => {
      const registered = await requestForgotPassword(ADMIN_EMAIL);
      const unregistered = await requestForgotPassword("no-such-admin@example.com");

      // Asserted explicitly, not just equality between the two — two
      // matching 404s would otherwise pass this trivially without proving
      // the endpoint actually works (this is exactly how the earlier wrong
      // endpoint-path guesses slipped past this pair of tests undetected).
      expect(registered.status).toBe(200);
      expect(registered.status).toBe(unregistered.status);
      expect(registered.body).toEqual(unregistered.body);
    });

    it("returns an identical response for a registered buyer and an unregistered email, and never emails the buyer", async () => {
      const buyerEmail = "buyer-forgot@example.com";
      await insertBuyer(buyerEmail);

      const buyerRes = await requestForgotPassword(buyerEmail);
      const unregistered = await requestForgotPassword("no-such-email@example.com");

      expect(buyerRes.status).toBe(200);
      expect(buyerRes.status).toBe(unregistered.status);
      expect(buyerRes.body).toEqual(unregistered.body);

      const { sendPasswordResetEmail } = await import("../../src/externalService/resend.js");
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe("Valid reset", () => {
    it("updates the password and the new password can sign in", async () => {
      const forgot = await requestForgotPassword(ADMIN_EMAIL);
      expect(forgot.status).toBe(200);
      const token = await captureResetToken();

      const reset = await request(app)
        .post("/api/auth/reset-password")
        .send({ newPassword: NEW_PASSWORD, token });
      expect(reset.status).toBe(200);
      expect(reset.body.success).toBe(true);

      const agent = request.agent(app);
      const signInWithNewPassword = await capturePasswordStep(agent, NEW_PASSWORD);
      expect(signInWithNewPassword.status).toBe(200);
      expect(signInWithNewPassword.body.success).toBe(true);
    });
  });

  describe("Token rejection", () => {
    it("rejects an expired token", async () => {
      await requestForgotPassword(ADMIN_EMAIL);
      const token = await captureResetToken();

      // Push every record in the (per-test-cleared) verification collection
      // into the past, rather than filtering by a guessed identifier shape
      // — same identifier-format-agnostic approach #140's own expired-OTP
      // test landed on after CI revealed the buyer emailOTP assumption
      // didn't hold for a different flow.
      await mongoose.connection
        .db!.collection("verification")
        .updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

      const reset = await request(app)
        .post("/api/auth/reset-password")
        .send({ newPassword: NEW_PASSWORD, token });
      expect(reset.status).toBeGreaterThanOrEqual(400);
      expect(reset.body.success).toBe(false);
    });

    it("rejects a reused token", async () => {
      await requestForgotPassword(ADMIN_EMAIL);
      const token = await captureResetToken();

      const first = await request(app)
        .post("/api/auth/reset-password")
        .send({ newPassword: NEW_PASSWORD, token });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post("/api/auth/reset-password")
        .send({ newPassword: "YetAnotherSecret!789", token });
      expect(second.status).toBeGreaterThanOrEqual(400);
      expect(second.body.success).toBe(false);
    });
  });

  describe("Session invalidation (FR-AUTH-022)", () => {
    it("invalidates every existing session for that admin after a reset", async () => {
      const agent = request.agent(app);
      const signIn = await signInFully(agent, ADMIN_PASSWORD);
      expect(signIn.status).toBe(200);
      const token = signIn.headers["set-auth-token"];
      expect(token).toBeTruthy();

      const beforeReset = await request(app)
        .get("/api/auth/get-session")
        .set("Authorization", `Bearer ${token}`);
      expect(beforeReset.body.data.user.email).toBe(ADMIN_EMAIL);

      await requestForgotPassword(ADMIN_EMAIL);
      const resetToken = await captureResetToken();
      const reset = await request(app)
        .post("/api/auth/reset-password")
        .send({ newPassword: NEW_PASSWORD, token: resetToken });
      expect(reset.status).toBe(200);

      const afterReset = await request(app)
        .get("/api/auth/get-session")
        .set("Authorization", `Bearer ${token}`);
      expect(afterReset.body.data ?? null).toBeFalsy();
    });
  });
});
