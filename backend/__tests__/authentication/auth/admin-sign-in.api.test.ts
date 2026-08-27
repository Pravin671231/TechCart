import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// Admin password + mandatory OTP sign-in (Issue #259/M3.21, FR-AUTH-009–017,
// 030). Kept as its own file, separate from auth.api.test.ts (#139, buyer
// sign-in) — the flow shape differs materially (two-step password-then-OTP
// vs. buyer's single-call methods).
//
// This is the hand-rolled replacement for Better Auth's emailAndPassword +
// twoFactor plugins (Issue #140/M3.2), built on #257's session engine +
// #258's `otps` collection. Wire-compatible with admin-app's existing flow:
//   POST /api/auth/sign-in/email        — password step, no session, sets a
//                                          signed `techcart_admin_2fa` cookie,
//                                          returns { code: "OTP_REQUIRED" }
//   POST /api/auth/two-factor/send-otp  — mints + emails the OTP for the
//                                          pending challenge (initial + resend)
//   POST /api/auth/two-factor/verify-otp — verifies, establishes the session
// The OTP is fixed to "123456" in every environment (otp.ts / Issue #242).
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

let mongod: MongoMemoryServer;
let mongoose: typeof mongooseType;
let app: Express;
let provisionAdminUser: typeof import("../../../src/scripts/seed/createAdminUser.js").provisionAdminUser;

const ADMIN_EMAIL = "admin-signin@example.com";
const ADMIN_PASSWORD = "Sup3rSecret!Pass";

beforeAll(async () => {
  const { MongoMemoryServer: MemoryServer } = await import("mongodb-memory-server");
  mongod = await MemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  mongoose = (await import("mongoose")).default;
  const { connectDB } = await import("../../../src/config/db.js");
  await connectDB();

  const appModule = await import("../../../src/app.js");
  app = (appModule as unknown as { default: Express }).default;

  const seedModule = await import("../../../src/scripts/seed/createAdminUser.js");
  provisionAdminUser = seedModule.provisionAdminUser;
}, 60000);

afterAll(async () => {
  await mongoose?.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.collection("users").deleteMany({});
  await mongoose.connection.db!.collection("otps").deleteMany({});
  await mongoose.connection.db!.collection("sessions").deleteMany({});

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

function capturePasswordStep(agent: ReturnType<typeof request.agent>) {
  return agent.post("/api/auth/sign-in/email").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
}

async function sendAndCaptureOtp(agent: ReturnType<typeof request.agent>): Promise<string> {
  const send = await agent.post("/api/auth/two-factor/send-otp").send({});
  expect(send.status).toBe(200);

  const { sendOtpEmail } = await import("../../../src/externalService/mailer.js");
  const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
  expect(otp).toBe("123456");
  return otp;
}

describe("Admin password + mandatory OTP sign-in", () => {
  describe("Happy path", () => {
    it("establishes a session only after password AND OTP both succeed", async () => {
      const agent = request.agent(app);

      const passwordRes = await capturePasswordStep(agent);
      expect(passwordRes.status).toBe(200);
      expect(passwordRes.body.success).toBe(true);
      expect(passwordRes.body.data.code).toBe("OTP_REQUIRED");

      // Correct password alone must not establish a session (FR-AUTH-014).
      const midFlowSession = await agent.get("/api/auth/get-session");
      expect(midFlowSession.body.data ?? null).toBeFalsy();

      await sendAndCaptureOtp(agent);

      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });
      expect(verify.status).toBe(200);
      expect(verify.body.success).toBe(true);
      expect(verify.body.data.user.email).toBe(ADMIN_EMAIL);
      expect(verify.body.data.user.role).toBe("super-admin");
      expect(verify.headers["set-auth-token"]).toBeTruthy();

      const session = await agent.get("/api/auth/get-session");
      expect(session.status).toBe(200);
      expect(session.body.data.user.email).toBe(ADMIN_EMAIL);
      expect(session.body.data.user.role).toBe("super-admin");
    });

    it("accepts an OTP well past the 3-minute mark, within the 10-minute window (Issue #254/M3.18)", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      await sendAndCaptureOtp(agent);

      // Simulate ~4 minutes elapsed of the 10-minute window by pulling the
      // stored record's expiry back to now+6min. The old Better Auth
      // twoFactor default expired at 3 minutes — this confirms the single
      // shared 10-minute otp.ts TTL fixes that by construction.
      await mongoose.connection
        .db!.collection("otps")
        .updateMany(
          { purpose: "admin-2fa" },
          { $set: { expiresAt: new Date(Date.now() + 6 * 60 * 1000) } },
        );

      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });
      expect(verify.status).toBe(200);
      expect(verify.body.success).toBe(true);
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
      expect(wrongPassword.body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it("never sets a challenge cookie on a wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email: ADMIN_EMAIL, password: "not-the-password" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      const setCookie = res.headers["set-cookie"];
      const cookies = setCookie ? (Array.isArray(setCookie) ? setCookie : [setCookie]) : [];
      expect(cookies.some((c: string) => c.includes("techcart_admin_2fa"))).toBe(false);
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
      // Matches the admin twoFactor plugin's own wrong-code error value that
      // admin-app's describeAuthError.ts already keys on (Issue #145/M3.7).
      expect(verify.body.code).toBe("INVALID_CODE");

      const session = await agent.get("/api/auth/get-session");
      expect(session.body.data ?? null).toBeFalsy();
    });

    it("rejects an expired OTP", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      await sendAndCaptureOtp(agent);

      await mongoose.connection
        .db!.collection("otps")
        .updateMany({ purpose: "admin-2fa" }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });
      expect(verify.status).toBeGreaterThanOrEqual(400);
      expect(verify.body.success).toBe(false);
      expect(verify.body.code).toBe("OTP_HAS_EXPIRED");
    });

    it("rejects a reused OTP", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      await sendAndCaptureOtp(agent);

      const first = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });
      expect(first.status).toBe(200);

      // Restart the challenge (a fresh password step — which does NOT mint a
      // new OTP) and replay the already-consumed code.
      const secondAgent = request.agent(app);
      await capturePasswordStep(secondAgent);
      const second = await secondAgent
        .post("/api/auth/two-factor/verify-otp")
        .send({ code: "123456" });

      expect(second.status).toBeGreaterThanOrEqual(400);
      expect(second.body.success).toBe(false);
      expect(second.body.code).toBe("INVALID_CODE");
    });

    it("rejects the OTP steps with no challenge cookie", async () => {
      const send = await request(app).post("/api/auth/two-factor/send-otp").send({});
      expect(send.status).toBe(401);
      expect(send.body.code).toBe("INVALID_TWO_FACTOR_COOKIE");

      const verify = await request(app)
        .post("/api/auth/two-factor/verify-otp")
        .send({ code: "123456" });
      expect(verify.status).toBe(401);
      expect(verify.body.code).toBe("INVALID_TWO_FACTOR_COOKIE");
    });
  });

  describe("Sign-out invalidation (FR-AUTH-017)", () => {
    it("rejects the session after sign-out", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      await sendAndCaptureOtp(agent);
      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });
      const token = verify.headers["set-auth-token"] as string;

      const beforeSignOut = await agent.get("/api/auth/get-session");
      expect(beforeSignOut.body.data.user.email).toBe(ADMIN_EMAIL);

      const signOut = await agent.post("/api/auth/sign-out").send({});
      expect(signOut.status).toBe(200);

      const afterSignOut = await agent.get("/api/auth/get-session");
      expect(afterSignOut.body.data ?? null).toBeFalsy();

      const withBearer = await request(app)
        .get("/api/auth/get-session")
        .set("Authorization", `Bearer ${token}`);
      expect(withBearer.body.data ?? null).toBeFalsy();
    });
  });

  describe("Session cookie flags (FR-AUTH-015–016)", () => {
    it("sets httpOnly/sameSite=lax on the session cookie in a non-https env", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      await sendAndCaptureOtp(agent);
      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });

      const setCookie = verify.headers["set-cookie"];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      const sessionCookie = cookies.find((c: string) => /techcart_session/i.test(c));
      expect(sessionCookie).toBeTruthy();
      expect(sessionCookie?.toLowerCase()).toContain("httponly");
      expect(sessionCookie?.toLowerCase()).toContain("samesite=lax");
    });
  });

  describe("Bearer-token session (cross-domain, mirrors Issue #139's own fix)", () => {
    it("resolves the session from an Authorization header alone, no cookies", async () => {
      const agent = request.agent(app);
      await capturePasswordStep(agent);
      await sendAndCaptureOtp(agent);
      const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });

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
      expect(res.body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    });
  });

  describe("OTP required signal (Issue #145/M3.7, FR-AUTH-045)", () => {
    it("stamps data.code=OTP_REQUIRED on the password-only response", async () => {
      const passwordRes = await capturePasswordStep(request.agent(app));

      expect(passwordRes.status).toBe(200);
      expect(passwordRes.body.success).toBe(true);
      expect(passwordRes.body.data.code).toBe("OTP_REQUIRED");
    });
  });

  describe("Account deactivation (Issue #145/M3.7, FR-AUTH-045)", () => {
    it("rejects the password step for a deactivated admin with ACCOUNT_DEACTIVATED", async () => {
      const deactivatedEmail = "deactivated-admin@example.com";
      await provisionAdminUser({
        email: deactivatedEmail,
        password: ADMIN_PASSWORD,
        name: "Deactivated Admin Fixture",
        role: "catalog-manager",
      });
      await mongoose.connection
        .db!.collection("users")
        .updateOne({ email: deactivatedEmail }, { $set: { status: false } });

      const res = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email: deactivatedEmail, password: ADMIN_PASSWORD });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("ACCOUNT_DEACTIVATED");

      const { sendOtpEmail } = await import("../../../src/externalService/mailer.js");
      expect(sendOtpEmail).not.toHaveBeenCalled();
    });
  });
});
