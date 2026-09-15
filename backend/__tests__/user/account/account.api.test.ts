import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Issue #144/M3.6 — buyer profile + admin change-password, both gated by
// rbac.ts (a real session, resolved via @/lib/session, is required — same as
// every route rewritten in #143). No repository mocking here —
// account.repository.ts reads/writes the real `users` collection directly,
// matching __tests__/adminUsers/adminUsers.api.test.ts's identical "real DB,
// no mocks" choice for this same collection.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  clearAuthCollections,
  signInFully,
  signInBuyer,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const ADMIN_EMAIL = "account-admin@example.com";
const ADMIN_PASSWORD = "OriginalPass!123";
const BUYER_EMAIL = "account-buyer@example.com";

let ctx: MemoryMongoContext;
let app: Express;
let provisionAdminUser: typeof import("../../../src/scripts/seed/createAdminUser.js").provisionAdminUser;

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;

  const seedModule = await import("../../../src/scripts/seed/createAdminUser.js");
  provisionAdminUser = seedModule.provisionAdminUser;
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

beforeEach(async () => {
  await clearAuthCollections(ctx.mongoose);
});

afterEach(() => {
  vi.clearAllMocks();
});

function req(method: "get" | "post" | "patch", url: string, token: string) {
  return authRequest(app, method, url, token);
}

describe("Buyer profile (FR-AUTH-036/037)", () => {
  it("returns 401 with no session at all", async () => {
    const res = await request(app).get("/api/account/profile");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("lets a signed-in buyer view their own profile", async () => {
    const token = await signInBuyer(app, BUYER_EMAIL);

    const res = await req("get", "/api/account/profile", token);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: BUYER_EMAIL });
  });

  it("lets a signed-in buyer update their name and phone", async () => {
    const token = await signInBuyer(app, BUYER_EMAIL);

    const res = await req("patch", "/api/account/profile", token).send({
      name: "Updated Buyer Name",
      phone: "+919876543210",
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: "Updated Buyer Name",
      phone: "+919876543210",
    });

    const refetch = await req("get", "/api/account/profile", token);
    expect(refetch.body.data).toMatchObject({
      name: "Updated Buyer Name",
      phone: "+919876543210",
    });
  });

  it("rejects an empty update body", async () => {
    const token = await signInBuyer(app, BUYER_EMAIL);

    const res = await req("patch", "/api/account/profile", token).send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects an admin session on the buyer-only profile routes", async () => {
    await provisionAdminUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: "Account Admin Fixture",
      role: "catalog-manager",
    });
    const token = await signInFully(app, ADMIN_EMAIL, ADMIN_PASSWORD);

    const res = await req("get", "/api/account/profile", token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});

describe("Admin change-password (FR-AUTH-038/039)", () => {
  it("rejects a buyer session on the admin-only change-password route", async () => {
    const token = await signInBuyer(app, BUYER_EMAIL);

    const res = await req("post", "/api/account/change-password", token).send({
      currentPassword: "whatever",
      newPassword: "NewPassword!123",
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("succeeds with the correct current password, invalidating every other session but the current one", async () => {
    await provisionAdminUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: "Account Admin Fixture",
      role: "catalog-manager",
    });
    const tokenA = await signInFully(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const tokenB = await signInFully(app, ADMIN_EMAIL, ADMIN_PASSWORD);

    const res = await req("post", "/api/account/change-password", tokenA).send({
      currentPassword: ADMIN_PASSWORD,
      newPassword: "BrandNewPass!456",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stillA = await request(app)
      .get("/api/auth/get-session")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(stillA.body.data?.user?.email).toBe(ADMIN_EMAIL);

    const deadB = await request(app)
      .get("/api/auth/get-session")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(deadB.body.data ?? null).toBeFalsy();

    const signInWithNewPassword = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: ADMIN_EMAIL, password: "BrandNewPass!456" });
    expect(signInWithNewPassword.status).toBe(200);
  });

  it("rejects an incorrect current password without invalidating any session", async () => {
    await provisionAdminUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: "Account Admin Fixture",
      role: "catalog-manager",
    });
    const tokenA = await signInFully(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const tokenB = await signInFully(app, ADMIN_EMAIL, ADMIN_PASSWORD);

    const res = await req("post", "/api/account/change-password", tokenA).send({
      currentPassword: "TotallyWrongPassword!1",
      newPassword: "BrandNewPass!456",
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CURRENT_PASSWORD");

    const stillA = await request(app)
      .get("/api/auth/get-session")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(stillA.body.data?.user?.email).toBe(ADMIN_EMAIL);

    const stillB = await request(app)
      .get("/api/auth/get-session")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(stillB.body.data?.user?.email).toBe(ADMIN_EMAIL);
  });
});
