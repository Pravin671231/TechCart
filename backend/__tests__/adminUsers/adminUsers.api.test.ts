import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// Admin account provisioning (Issue #142/M3.4, FR-AUTH-024–029). Low-level
// setup (mongodb-memory-server, dynamic imports so MONGODB_URI is set before
// @/config/env is first evaluated, mocked resend) copied verbatim from
// admin-sign-in.api.test.ts/admin-password-reset.api.test.ts's established
// convention — this suite needs the same real Better Auth session/user state
// (requireRole.ts's auth.api.getSession call can't be trusted against a
// mocked adapter either).
//
// These routes sit behind BOTH the existing X-Admin-Key router guard
// (adminAuth.ts, unchanged since #25) AND the new requireRole("super-admin")
// session guard (#142) — every request below sends both.
vi.mock("@/externalService/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

let mongod: MongoMemoryServer;
let mongoose: typeof mongooseType;
let app: Express;
let provisionAdminUser: typeof import("../../src/scripts/seed/createAdminUser.js").provisionAdminUser;
let env: typeof import("../../src/config/env.js").env;

const SUPER_ADMIN_EMAIL = "super-admin-users@example.com";
const SUPER_ADMIN_PASSWORD = "Sup3rSecret!Pass";
const OTHER_SUPER_ADMIN_EMAIL = "other-super-admin@example.com";
const OTHER_SUPER_ADMIN_PASSWORD = "AnotherSuper!Pass1";
const CATALOG_MANAGER_EMAIL = "catalog-manager-fixture@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";

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

  const envModule = await import("../../src/config/env.js");
  env = envModule.env;
}, 60000);

afterAll(async () => {
  await mongoose?.disconnect();
  await mongod?.stop();
});

async function clearAuthCollections() {
  await mongoose.connection.db!.collection("users").deleteMany({});
  await mongoose.connection.db!.collection("account").deleteMany({});
  await mongoose.connection.db!.collection("verification").deleteMany({});
  await mongoose.connection.db!.collection("session").deleteMany({});
  await mongoose.connection.db!.collection("twoFactor").deleteMany({});
  await mongoose.connection.db!.collection("passwordresettokens").deleteMany({});
}

async function signInFully(email: string, password: string): Promise<string> {
  const agent = request.agent(app);
  const passwordRes = await agent.post("/api/auth/sign-in/email").send({ email, password });
  expect(passwordRes.status).toBe(200);

  const send = await agent.post("/api/auth/two-factor/send-otp").send({});
  expect(send.status).toBe(200);

  const { sendOtpEmail } = await import("../../src/externalService/resend.js");
  const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
  expect(otp).toBeTruthy();

  const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: otp });
  expect(verify.status).toBe(200);

  const token = verify.headers["set-auth-token"] as string;
  expect(token).toBeTruthy();
  return token;
}

function adminRequest(method: "get" | "post" | "patch", url: string, token: string) {
  return request(app)[method](url)
    .set("X-Admin-Key", env.ADMIN_API_KEY)
    .set("Authorization", `Bearer ${token}`);
}

let superAdminToken: string;
let superAdminId: string;

beforeEach(async () => {
  await clearAuthCollections();

  await provisionAdminUser({
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    name: "Super Admin Fixture",
    role: "super-admin",
  });
  superAdminToken = await signInFully(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

  const superAdminDoc = await mongoose.connection
    .db!.collection<{ _id: unknown; email: string }>("users")
    .findOne({ email: SUPER_ADMIN_EMAIL });
  superAdminId = String(superAdminDoc!._id);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Admin account provisioning", () => {
  describe("POST /api/admin/users (FR-AUTH-025)", () => {
    it("creates a catalog-manager with 2FA enabled and no immediate session/password bypass", async () => {
      const res = await adminRequest("post", "/api/admin/users", superAdminToken).send({
        email: "new-catalog-manager@example.com",
        name: "New Catalog Manager",
        role: "catalog-manager",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe("new-catalog-manager@example.com");
      expect(res.body.data.role).toBe("catalog-manager");

      const stored = await mongoose.connection
        .db!.collection<{ email: string; twoFactorEnabled?: boolean }>("users")
        .findOne({ email: "new-catalog-manager@example.com" });
      expect(stored?.twoFactorEnabled).toBe(true);

      // FR-AUTH-029: the new admin must still go through the full
      // password+OTP sign-in flow via a real reset-password link, never an
      // auto-established session or a caller-visible temporary password.
      expect(res.body.data.password).toBeUndefined();
      const { sendPasswordResetEmail } = await import("../../src/externalService/resend.js");
      expect(sendPasswordResetEmail).toHaveBeenCalled();

      const record = await mongoose.connection
        .db!.collection<{ token: string }>("passwordresettokens")
        .findOne({}, { sort: { _id: -1 } });
      expect(record?.token).toBeTruthy();

      const setPassword = "BrandNewPass!123";
      const reset = await request(app)
        .post("/api/auth/reset-password")
        .send({ newPassword: setPassword, token: record!.token });
      expect(reset.status).toBe(200);

      const signInRes = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email: "new-catalog-manager@example.com", password: setPassword });
      expect(signInRes.status).toBe(200);

      // Password step alone must not establish a session — the mandatory
      // OTP step is still required, no bypass for an API-provisioned admin.
      const agent = request.agent(app);
      await agent
        .post("/api/auth/sign-in/email")
        .send({ email: "new-catalog-manager@example.com", password: setPassword });
      const midFlowSession = await agent.get("/api/auth/get-session");
      expect(midFlowSession.body.data ?? null).toBeFalsy();
    });

    it("creates an order-manager", async () => {
      const res = await adminRequest("post", "/api/admin/users", superAdminToken).send({
        email: "new-order-manager@example.com",
        name: "New Order Manager",
        role: "order-manager",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe("order-manager");
    });
  });

  describe("GET /api/admin/users", () => {
    beforeEach(async () => {
      await provisionAdminUser({
        email: CATALOG_MANAGER_EMAIL,
        password: CATALOG_MANAGER_PASSWORD,
        name: "Catalog Manager Fixture",
        role: "catalog-manager",
      });
    });

    it("lists admin accounts with pagination", async () => {
      const res = await adminRequest("get", "/api/admin/users?limit=1&page=1", superAdminToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it("filters by search", async () => {
      const res = await adminRequest(
        "get",
        "/api/admin/users?search=Catalog Manager Fixture",
        superAdminToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toBe(CATALOG_MANAGER_EMAIL);
    });

    it("filters by role", async () => {
      const res = await adminRequest(
        "get",
        "/api/admin/users?role=catalog-manager",
        superAdminToken,
      );
      expect(res.status).toBe(200);
      expect(
        (res.body.data as Array<{ role: string }>).every((u) => u.role === "catalog-manager"),
      ).toBe(true);
    });
  });

  describe("PATCH /api/admin/users/:id (FR-AUTH-026, FR-AUTH-028)", () => {
    it("updates an admin's role", async () => {
      const created = await provisionAdminUser({
        email: CATALOG_MANAGER_EMAIL,
        password: CATALOG_MANAGER_PASSWORD,
        name: "Catalog Manager Fixture",
        role: "catalog-manager",
      });
      const doc = await mongoose.connection
        .db!.collection<{ _id: unknown; email: string }>("users")
        .findOne({ email: created.email });

      const res = await adminRequest(
        "patch",
        `/api/admin/users/${String(doc!._id)}`,
        superAdminToken,
      ).send({ role: "order-manager" });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe("order-manager");
    });

    it("deactivating an admin invalidates every existing session for them", async () => {
      await provisionAdminUser({
        email: CATALOG_MANAGER_EMAIL,
        password: CATALOG_MANAGER_PASSWORD,
        name: "Catalog Manager Fixture",
        role: "catalog-manager",
      });
      const targetToken = await signInFully(CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);
      const targetDoc = await mongoose.connection
        .db!.collection<{ _id: unknown; email: string }>("users")
        .findOne({ email: CATALOG_MANAGER_EMAIL });

      const beforeDeactivate = await request(app)
        .get("/api/auth/get-session")
        .set("Authorization", `Bearer ${targetToken}`);
      expect(beforeDeactivate.body.data.user.email).toBe(CATALOG_MANAGER_EMAIL);

      const res = await adminRequest(
        "patch",
        `/api/admin/users/${String(targetDoc!._id)}`,
        superAdminToken,
      ).send({ status: false });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(false);

      const afterDeactivate = await request(app)
        .get("/api/auth/get-session")
        .set("Authorization", `Bearer ${targetToken}`);
      expect(afterDeactivate.body.data ?? null).toBeFalsy();
    });

    it("rejects an admin modifying their own account", async () => {
      const res = await adminRequest(
        "patch",
        `/api/admin/users/${superAdminId}`,
        superAdminToken,
      ).send({ status: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("CANNOT_MODIFY_OWN_ACCOUNT");
    });
  });

  describe("Role enforcement (super-admin only)", () => {
    it("rejects a request with no session at all", async () => {
      const res = await request(app).get("/api/admin/users").set("X-Admin-Key", env.ADMIN_API_KEY);
      expect(res.status).toBe(401);
    });

    it("rejects a non-super-admin session", async () => {
      await provisionAdminUser({
        email: CATALOG_MANAGER_EMAIL,
        password: CATALOG_MANAGER_PASSWORD,
        name: "Catalog Manager Fixture",
        role: "catalog-manager",
      });
      const token = await signInFully(CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);

      const res = await adminRequest("get", "/api/admin/users", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });
  });

  describe("Seed idempotency", () => {
    it("provisionAdminUser run twice against the same email creates no duplicate", async () => {
      const first = await provisionAdminUser({
        email: OTHER_SUPER_ADMIN_EMAIL,
        password: OTHER_SUPER_ADMIN_PASSWORD,
        name: "Other Super Admin",
        role: "super-admin",
      });
      expect(first.created).toBe(true);

      const second = await provisionAdminUser({
        email: OTHER_SUPER_ADMIN_EMAIL,
        password: OTHER_SUPER_ADMIN_PASSWORD,
        name: "Other Super Admin",
        role: "super-admin",
      });
      expect(second.created).toBe(false);

      const count = await mongoose.connection
        .db!.collection("users")
        .countDocuments({ email: OTHER_SUPER_ADMIN_EMAIL });
      expect(count).toBe(1);
    });
  });
});
