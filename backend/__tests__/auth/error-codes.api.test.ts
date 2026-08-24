import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  clearAuthCollections,
  signInBuyer,
  authRequest,
  type MemoryMongoContext,
} from "../testHelpers/adminSession.js";

// Issue #145/M3.7 (FR-AUTH-045) — one dedicated suite proving every named
// error-code category is both real (reachable end-to-end against the real
// app + DB, never asserted from documentation alone) and pairwise distinct
// from every other category, so a frontend can branch on `code` alone.
// Reuses whichever real endpoint already produces each code rather than
// constructing a synthetic one — see each step's own comment for where that
// code actually originates in this codebase. No renames of pre-existing
// codes (INVALID_EMAIL_OR_PASSWORD, FORBIDDEN, UNAUTHENTICATED,
// GOOGLE_ACCOUNT_IS_ADMIN) — the SRS's own illustrative names
// (INVALID_CREDENTIALS, FORBIDDEN_ROLE) stay illustrative, same "endpoint
// table over issue-body phrasing" precedent this codebase has followed
// throughout M2/M3.
vi.mock("@/externalService/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

let ctx: MemoryMongoContext;
let provisionAdminUser: typeof import("../../src/scripts/seed/createAdminUser.js").provisionAdminUser;

const ADMIN_EMAIL = "error-codes-admin@example.com";
const ADMIN_PASSWORD = "Sup3rSecret!Pass";

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  const seedModule = await import("../../src/scripts/seed/createAdminUser.js");
  provisionAdminUser = seedModule.provisionAdminUser;
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

beforeEach(async () => {
  await clearAuthCollections(ctx.mongoose);
  await provisionAdminUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: "Error Codes Fixture",
    role: "super-admin",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FR-AUTH-045 error-code enumeration", () => {
  it("produces a distinct, stable code for every named category", async () => {
    const codes: Record<string, string> = {};

    // 1. Invalid credentials — src/lib/auth.ts's generic
    // INVALID_EMAIL_OR_PASSWORD, shared by wrong-password and unknown-email.
    const wrongPassword = await request(ctx.app)
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
    await ctx.mongoose.connection
      .db!.collection("users")
      .updateOne({ email: deactivatedEmail }, { $set: { status: false } });
    const deactivated = await request(ctx.app)
      .post("/api/auth/sign-in/email")
      .send({ email: deactivatedEmail, password: ADMIN_PASSWORD });
    codes.accountDeactivated = deactivated.body.code;

    // 3. OTP required — the password-only step's data.code (Issue #145,
    // betterAuthHandler.ts's twoFactorRedirect stamping).
    const agent = request.agent(ctx.app);
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
    const agent2 = request.agent(ctx.app);
    await agent2
      .post("/api/auth/sign-in/email")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    await agent2.post("/api/auth/two-factor/send-otp").send({});
    const { sendOtpEmail } = await import("../../src/externalService/resend.js");
    const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    await ctx.mongoose.connection
      .db!.collection("verification")
      .updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const expiredOtp = await agent2.post("/api/auth/two-factor/verify-otp").send({ code: otp });
    codes.otpExpired = expiredOtp.body.code;

    // 6. No session — rbac.ts's UNAUTHENTICATED on a protected admin route.
    const noSession = await request(ctx.app).get("/api/admin/brands");
    codes.unauthenticated = noSession.body.code;

    // 7. Wrong role — rbac.ts's FORBIDDEN, a buyer session on an
    // admin/catalog-manager-only route.
    const buyerToken = await signInBuyer(ctx.app, "error-codes-buyer@example.com");
    const wrongRole = await authRequest(ctx.app, "get", "/api/admin/brands", buyerToken);
    codes.forbiddenRole = wrongRole.body.code;

    // 8. Admin-email-on-buyer-route — src/lib/auth.ts's
    // GOOGLE_ACCOUNT_IS_ADMIN, a buyer OTP request for a registered admin's
    // email.
    const adminOnBuyerRoute = await request(ctx.app)
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
