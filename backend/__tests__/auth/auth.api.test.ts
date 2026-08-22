import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// This suite needs a real MongoDB instance — Better Auth's account-dedup
// logic (FR-AUTH-005/006) can't be trusted against a mocked adapter, and
// every other suite in this codebase mocks the repository layer instead.
// mongodb-memory-server picks a random port at runtime, so MONGODB_URI must
// be set *before* `@/config/env` (and anything that imports it, including
// `@/app`) is first evaluated — env.ts parses process.env once, at import
// time. That's why every import below is dynamic, inside beforeAll, instead
// of a static top-level import like every other test file in this repo uses.
vi.mock("@better-auth/core/social-providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@better-auth/core/social-providers")>();
  return {
    ...actual,
    verifyGoogleIdToken: vi.fn(),
  };
});

vi.mock("@better-auth/core/oauth2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@better-auth/core/oauth2")>();
  return {
    ...actual,
    validateAuthorizationCode: vi.fn(),
  };
});

vi.mock("@/externalService/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

function fakeGoogleIdToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.fake-signature`;
}

let mongod: MongoMemoryServer;
let mongoose: typeof mongooseType;
let app: Express;
let socialProviders: typeof import("@better-auth/core/social-providers");
let oauth2: typeof import("@better-auth/core/oauth2");

beforeAll(async () => {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  mongoose = (await import("mongoose")).default;
  const { connectDB } = await import("../../src/config/db.js");
  await connectDB();

  // TS's dynamic-`import()` typing for a CJS-emitted module (this workspace
  // is `"type": "commonjs"`) doesn't narrow to the named `default` export
  // the way a static import does — cast past it rather than chase the
  // ESM/CJS interop gap further.
  const appModule = await import("../../src/app.js");
  app = (appModule as unknown as { default: Express }).default;

  socialProviders = await import("@better-auth/core/social-providers");
  oauth2 = await import("@better-auth/core/oauth2");
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
});

afterEach(() => {
  vi.clearAllMocks();
});

async function insertAdminUser(email: string, role = "super-admin") {
  await mongoose.connection.db!.collection("users").insertOne({
    _id: new mongoose.Types.ObjectId(),
    name: "Existing Admin",
    email,
    emailVerified: true,
    role,
    status: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("Buyer passwordless authentication", () => {
  describe("Google One Tap (POST /api/auth/one-tap/callback)", () => {
    it("creates a buyer account on first sign-in", async () => {
      vi.mocked(socialProviders.verifyGoogleIdToken).mockResolvedValue({
        sub: "google-sub-1",
        email: "onetap-buyer@example.com",
        email_verified: true,
        name: "One Tap Buyer",
      });

      const res = await request(app)
        .post("/api/auth/one-tap/callback")
        .send({ idToken: "fake-id-token" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("onetap-buyer@example.com");

      const stored = await mongoose.connection
        .db!.collection("users")
        .findOne({ email: "onetap-buyer@example.com" });
      expect(stored?.role).toBe("buyer");
    });

    it("rejects one-tap sign-in for an email already registered as an admin", async () => {
      await insertAdminUser("admin-onetap@example.com");
      vi.mocked(socialProviders.verifyGoogleIdToken).mockResolvedValue({
        sub: "google-sub-admin",
        email: "admin-onetap@example.com",
        email_verified: true,
        name: "Admin",
      });

      const res = await request(app)
        .post("/api/auth/one-tap/callback")
        .send({ idToken: "fake-id-token" });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: "GOOGLE_ACCOUNT_IS_ADMIN",
      });
    });
  });

  describe("Google OAuth (sign-in/social + callback, mocked token exchange)", () => {
    it("creates a buyer account via the OAuth callback", async () => {
      vi.mocked(oauth2.validateAuthorizationCode).mockResolvedValue({
        idToken: fakeGoogleIdToken({
          sub: "google-sub-oauth-1",
          email: "oauth-buyer@example.com",
          email_verified: true,
          name: "OAuth Buyer",
        }),
        accessToken: "fake-access-token",
        tokenType: "Bearer",
      });

      const agent = request.agent(app);

      const start = await agent
        .post("/api/auth/sign-in/social")
        .send({ provider: "google", callbackURL: "http://localhost:3000/" });
      expect(start.status).toBe(200);
      const redirectUrl = new URL(start.body.data.url);
      const state = redirectUrl.searchParams.get("state")!;

      const callback = await agent
        .get("/api/auth/callback/google")
        .query({ state, code: "fake-authorization-code" });

      expect([302, 200]).toContain(callback.status);

      const stored = await mongoose.connection
        .db!.collection("users")
        .findOne({ email: "oauth-buyer@example.com" });
      expect(stored).not.toBeNull();
      expect(stored?.role).toBe("buyer");
    });
  });

  describe("Email OTP (send-verification-otp + sign-in/email-otp)", () => {
    it("creates a buyer account on first OTP sign-in", async () => {
      const email = "otp-buyer@example.com";

      const send = await request(app)
        .post("/api/auth/email-otp/send-verification-otp")
        .send({ email, type: "sign-in" });
      expect(send.status).toBe(200);
      expect(send.body.success).toBe(true);

      const record = await mongoose.connection
        .db!.collection("verification")
        .findOne({ identifier: { $regex: email } });
      expect(record).not.toBeNull();

      // storeOTP: "hashed" means the plaintext code never sits in the DB —
      // the real code was only ever handed to the mocked sendOtpEmail call.
      const { sendOtpEmail } = await import("../../src/externalService/resend.js");
      const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
      expect(otp).toBeTruthy();

      const verify = await request(app).post("/api/auth/sign-in/email-otp").send({ email, otp });

      expect(verify.status).toBe(200);
      expect(verify.body.data.user.email).toBe(email);

      const stored = await mongoose.connection.db!.collection("users").findOne({ email });
      expect(stored?.role).toBe("buyer");
    });

    it("rejects a reused OTP", async () => {
      const email = "otp-reuse@example.com";
      await request(app)
        .post("/api/auth/email-otp/send-verification-otp")
        .send({ email, type: "sign-in" });

      const { sendOtpEmail } = await import("../../src/externalService/resend.js");
      const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;

      const first = await request(app).post("/api/auth/sign-in/email-otp").send({ email, otp });
      expect(first.status).toBe(200);

      const second = await request(app).post("/api/auth/sign-in/email-otp").send({ email, otp });
      expect(second.status).toBeGreaterThanOrEqual(400);
      expect(second.body.success).toBe(false);
    });

    it("rejects an expired OTP", async () => {
      const email = "otp-expired@example.com";
      await request(app)
        .post("/api/auth/email-otp/send-verification-otp")
        .send({ email, type: "sign-in" });

      const { sendOtpEmail } = await import("../../src/externalService/resend.js");
      const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;

      // expiresIn is 600s (FR-AUTH-007) — push the stored verification
      // record's expiry into the past instead of faking the system clock,
      // so Better Auth's own internal timers/timeouts are unaffected.
      await mongoose.connection
        .db!.collection("verification")
        .updateMany(
          { identifier: { $regex: email } },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );

      const res = await request(app).post("/api/auth/sign-in/email-otp").send({ email, otp });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects a buyer OTP sign-in for an email already registered as an admin", async () => {
      await insertAdminUser("admin-otp@example.com");

      const send = await request(app)
        .post("/api/auth/email-otp/send-verification-otp")
        .send({ email: "admin-otp@example.com", type: "sign-in" });

      expect(send.status).toBe(403);
      expect(send.body).toMatchObject({ success: false, code: "GOOGLE_ACCOUNT_IS_ADMIN" });

      const { sendOtpEmail } = await import("../../src/externalService/resend.js");
      expect(sendOtpEmail).not.toHaveBeenCalled();
    });
  });

  describe("Cross-method account dedup (FR-AUTH-005)", () => {
    it("resolves a second buyer sign-in method with the same email to the original account", async () => {
      const email = "dedup-buyer@example.com";

      vi.mocked(socialProviders.verifyGoogleIdToken).mockResolvedValue({
        sub: "google-sub-dedup",
        email,
        email_verified: true,
        name: "Dedup Buyer",
      });
      const oneTapRes = await request(app)
        .post("/api/auth/one-tap/callback")
        .send({ idToken: "fake-id-token" });
      const firstUserId = oneTapRes.body.data.user.id;

      const send = await request(app)
        .post("/api/auth/email-otp/send-verification-otp")
        .send({ email, type: "sign-in" });
      expect(send.status).toBe(200);

      const { sendOtpEmail } = await import("../../src/externalService/resend.js");
      const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;

      const otpRes = await request(app).post("/api/auth/sign-in/email-otp").send({ email, otp });
      expect(otpRes.status).toBe(200);
      expect(otpRes.body.data.user.id).toBe(firstUserId);

      const count = await mongoose.connection.db!.collection("users").countDocuments({ email });
      expect(count).toBe(1);
    });
  });

  describe("No client-supplied role (FR-AUTH-004)", () => {
    it("ignores a client-submitted role and defaults every new account to buyer", async () => {
      const email = "role-spoof@example.com";
      await request(app)
        .post("/api/auth/email-otp/send-verification-otp")
        .send({ email, type: "sign-in" });

      const { sendOtpEmail } = await import("../../src/externalService/resend.js");
      const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;

      const res = await request(app)
        .post("/api/auth/sign-in/email-otp")
        .send({ email, otp, role: "super-admin" });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe("buyer");

      const stored = await mongoose.connection.db!.collection("users").findOne({ email });
      expect(stored?.role).toBe("buyer");
    });
  });
});
