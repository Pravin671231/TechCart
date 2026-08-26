import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";
import { signInBuyer, authRequest } from "../../testHelpers/adminSession.js";

// Issue #145/M3.7 (FR-AUTH-040–045) — rate limiting plus the FR-AUTH-045
// error-code enumeration share one file/one mongodb-memory-server instance,
// not two, deliberately: an earlier version split these into two separate
// files, each with its own bootstrapMemoryMongo() bootstrap, and a real CI
// run showed that pushing the total number of concurrent
// mongodb-memory-server instances across the whole suite (11 pre-existing
// files + 2 new ones) past whatever this runner can reliably handle caused
// *widespread* ECONNREFUSED failures — not just in these two new files, but
// in several pre-existing, untouched ones too (confirmed via the actual CI
// job log: 13 failed suites, all mongodb-memory-server-based, on the run
// that added these two files). Sharing one instance for both concerns here
// keeps this issue's net-new concurrent-instance count at 1, not 2.
//
// Rate limiting itself exercises two independent layers without needing to
// know which one actually fires for a given request: Better Auth's own
// native per-request limiter (src/lib/auth.ts's `rateLimit.customRules`,
// keyed by IP via `x-forwarded-for` — no trustedProxies configured, so a
// single-value forwarded header is trusted directly, confirmed against the
// installed better-auth@1.7.1 package's own utils/ip.mjs) and this repo's
// own `enforceEmailRateLimits` hook (keyed by email, for the three paths
// whose body carries one). Both funnel through the same `RATE_LIMITED` code
// via betterAuthHandler.ts's fallback.
//
// Each rate-limiting `it` block below sets its own distinct
// `X-Forwarded-For` value so a test's IP-keyed bucket can't bleed into
// another's — on top of vitest.setup.ts's global `resetAllRateLimiters()`
// after every test, which is what keeps this suite from tripping on
// *other* files' repeated sign-ins (see that file's own comment for why the
// reset is global, not local to this file).
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// Same mock auth.api.test.ts already established for #139's own One
// Tap/OAuth tests — without it, the OAuth-callback rate-limit case below
// would send its 20 allowed requests' garbage idToken to Google's *real*
// token-verification endpoint, a real outbound network call this sandboxed
// CI environment cannot reliably complete (confirmed the hard way: an
// earlier version of this file without this mock stalled the whole `test
// (backend)` CI job for 20+ minutes rather than failing fast).
vi.mock("@better-auth/core/social-providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@better-auth/core/social-providers")>();
  return {
    ...actual,
    verifyGoogleIdToken: vi.fn().mockRejectedValue(new Error("invalid token")),
  };
});

let mongod: MongoMemoryServer;
let mongoose: typeof mongooseType;
let app: Express;
let provisionAdminUser: typeof import("../../../src/scripts/seed/createAdminUser.js").provisionAdminUser;

const ADMIN_EMAIL = "rate-limit-admin@example.com";
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
  await mongoose.connection.db!.collection("account").deleteMany({});
  await mongoose.connection.db!.collection("verification").deleteMany({});
  await mongoose.connection.db!.collection("session").deleteMany({});
  await mongoose.connection.db!.collection("twoFactor").deleteMany({});

  await provisionAdminUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: "Rate Limit Fixture",
    role: "super-admin",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Auth rate limiting (Issue #145/M3.7)", () => {
  describe("Admin sign-in/OTP-verify (FR-AUTH-040)", () => {
    it("returns 429 RATE_LIMITED after exceeding the sign-in limit for one IP", async () => {
      const ip = "10.0.1.1";
      let last;
      for (let i = 0; i < 6; i++) {
        last = await request(app)
          .post("/api/auth/sign-in/email")
          .set("X-Forwarded-For", ip)
          .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      }

      expect(last!.status).toBe(429);
      expect(last!.body).toMatchObject({ success: false, code: "RATE_LIMITED" });
    });
  });

  describe("Admin OTP-resend (FR-AUTH-041)", () => {
    it("returns 429 RATE_LIMITED after exceeding the OTP-resend limit, independent of sign-in", async () => {
      const ip = "10.0.1.2";
      const agent = request.agent(app);
      await agent
        .post("/api/auth/sign-in/email")
        .set("X-Forwarded-For", ip)
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      let last;
      for (let i = 0; i < 4; i++) {
        last = await agent.post("/api/auth/two-factor/send-otp").set("X-Forwarded-For", ip).send({});
      }

      expect(last!.status).toBe(429);
      expect(last!.body).toMatchObject({ success: false, code: "RATE_LIMITED" });
    });
  });

  describe("Admin forgot-password (FR-AUTH-042)", () => {
    it("returns 429 RATE_LIMITED after exceeding the reset-request limit for one email", async () => {
      const ip = "10.0.1.3";
      let last;
      for (let i = 0; i < 4; i++) {
        last = await request(app)
          .post("/api/auth/request-password-reset")
          .set("X-Forwarded-For", ip)
          .send({ email: ADMIN_EMAIL });
      }

      expect(last!.status).toBe(429);
      expect(last!.body).toMatchObject({ success: false, code: "RATE_LIMITED" });

      const { sendPasswordResetEmail } = await import("../../../src/externalService/mailer.js");
      // At most 3 of the 4 attempts could have gotten far enough to send —
      // the point is the 4th never does, not that none of the earlier ones did.
      expect((sendPasswordResetEmail as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Buyer OTP-request (FR-AUTH-043)", () => {
    it("returns 429 RATE_LIMITED after exceeding the OTP-request limit for one email", async () => {
      const ip = "10.0.1.4";
      const email = "rate-limit-buyer@example.com";
      let last;
      for (let i = 0; i < 6; i++) {
        last = await request(app)
          .post("/api/auth/email-otp/send-verification-otp")
          .set("X-Forwarded-For", ip)
          .send({ email, type: "sign-in" });
      }

      expect(last!.status).toBe(429);
      expect(last!.body).toMatchObject({ success: false, code: "RATE_LIMITED" });
    });

    it("does not affect the other four limiters (each still works for a fresh identity)", async () => {
      const trippedIp = "10.0.1.5";
      const trippedEmail = "rate-limit-buyer-2@example.com";
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post("/api/auth/email-otp/send-verification-otp")
          .set("X-Forwarded-For", trippedIp)
          .send({ email: trippedEmail, type: "sign-in" });
      }

      // A completely different identity on each of the other four paths —
      // none should see the buyer-OTP-request bucket above at all.
      const signIn = await request(app)
        .post("/api/auth/sign-in/email")
        .set("X-Forwarded-For", "10.0.1.6")
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      expect(signIn.status).not.toBe(429);

      const forgotPassword = await request(app)
        .post("/api/auth/request-password-reset")
        .set("X-Forwarded-For", "10.0.1.7")
        .send({ email: ADMIN_EMAIL });
      expect(forgotPassword.status).not.toBe(429);

      const otherBuyer = await request(app)
        .post("/api/auth/email-otp/send-verification-otp")
        .set("X-Forwarded-For", "10.0.1.8")
        .send({ email: "not-the-tripped-buyer@example.com", type: "sign-in" });
      expect(otherBuyer.status).not.toBe(429);
    });
  });

  describe("Google OAuth callback / One Tap (FR-AUTH-044)", () => {
    it("returns 429 RATE_LIMITED after exceeding the OAuth callback limit for one IP", async () => {
      const ip = "10.0.1.9";
      let last;
      // max: 20 — the underlying token is never valid, but Better Auth's
      // native rate limiter runs before any endpoint logic (confirmed
      // against the installed package's own api/index.mjs `onRequest`), so
      // every one of these 21 calls counts against the bucket regardless of
      // what status the 20 allowed ones get for an invalid token.
      for (let i = 0; i < 21; i++) {
        last = await request(app)
          .post("/api/auth/one-tap/callback")
          .set("X-Forwarded-For", ip)
          .send({ idToken: "not-a-real-token" });
      }

      expect(last!.status).toBe(429);
      expect(last!.body).toMatchObject({ success: false, code: "RATE_LIMITED" });
    }, 20000);
  });
});

describe("FR-AUTH-045 error-code enumeration", () => {
  it("produces a distinct, stable code for every named category", async () => {
    const codes: Record<string, string> = {};

    // 1. Invalid credentials — src/lib/auth.ts's generic
    // INVALID_EMAIL_OR_PASSWORD, shared by wrong-password and unknown-email.
    const wrongPassword = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: ADMIN_EMAIL, password: "wrong-password" });
    codes.invalidCredentials = wrongPassword.body.code;

    // 2. Account deactivated — enforceAccountNotDeactivated (Issue #145).
    const deactivatedEmail = "deactivated-fixture@example.com";
    await provisionAdminUser({
      email: deactivatedEmail,
      password: ADMIN_PASSWORD,
      name: "Deactivated Fixture",
      role: "catalog-manager",
    });
    await mongoose.connection
      .db!.collection("users")
      .updateOne({ email: deactivatedEmail }, { $set: { status: false } });
    const deactivated = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: deactivatedEmail, password: ADMIN_PASSWORD });
    codes.accountDeactivated = deactivated.body.code;

    // 3. OTP required — the password-only step's data.code (Issue #145,
    // betterAuthHandler.ts's twoFactorRedirect stamping).
    const agent = request.agent(app);
    const passwordRes = await agent
      .post("/api/auth/sign-in/email")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    codes.otpRequired = passwordRes.body.data.code;

    // 4. OTP invalid — admin twoFactor plugin, confirmed INVALID_CODE
    // against the installed better-auth@1.7.1 package's own
    // plugins/two-factor/error-code.mjs.
    const sendOtp = await agent.post("/api/auth/two-factor/send-otp").send({});
    expect(sendOtp.status).toBe(200);
    const wrongOtp = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "000000" });
    codes.otpInvalid = wrongOtp.body.code;

    // 5. OTP expired — admin twoFactor plugin, confirmed OTP_HAS_EXPIRED
    // (distinct from #4's INVALID_CODE) against the same installed package.
    const agent2 = request.agent(app);
    await agent2
      .post("/api/auth/sign-in/email")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    await agent2.post("/api/auth/two-factor/send-otp").send({});
    await mongoose.connection
      .db!.collection("verification")
      .updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    // Issue #242/M3.14 — auth.ts's databaseHooks.verification.create.before
    // forces every 2fa-otp-* record's stored value to "123456:0" regardless
    // of the real (random) emailed code, so "123456" is the code that would
    // verify if not expired — submitting it here specifically exercises the
    // expiry branch, not an incidental wrong-code rejection.
    const expiredOtp = await agent2.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });
    codes.otpExpired = expiredOtp.body.code;

    // 6. No session — rbac.ts's UNAUTHENTICATED on a protected admin route.
    const noSession = await request(app).get("/api/admin/brands");
    codes.unauthenticated = noSession.body.code;

    // 7. Wrong role — rbac.ts's FORBIDDEN, a buyer session on an
    // admin/catalog-manager-only route.
    const buyerToken = await signInBuyer(app, "error-codes-buyer@example.com");
    const wrongRole = await authRequest(app, "get", "/api/admin/brands", buyerToken);
    codes.forbiddenRole = wrongRole.body.code;

    // 8. Admin-email-on-buyer-route — src/lib/auth.ts's
    // GOOGLE_ACCOUNT_IS_ADMIN, a buyer OTP request for a registered admin's
    // email.
    const adminOnBuyerRoute = await request(app)
      .post("/api/auth/email-otp/send-verification-otp")
      .send({ email: ADMIN_EMAIL, type: "sign-in" });
    codes.adminEmailOnBuyerRoute = adminOnBuyerRoute.body.code;

    for (const [category, code] of Object.entries(codes)) {
      expect(code, `expected a real code for "${category}"`).toBeTruthy();
    }

    const distinctCodes = new Set(Object.values(codes));
    expect(distinctCodes.size, `codes must be pairwise distinct: ${JSON.stringify(codes, null, 2)}`).toBe(
      Object.keys(codes).length,
    );
  });
});
