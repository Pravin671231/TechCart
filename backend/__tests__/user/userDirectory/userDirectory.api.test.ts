import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// Issue #385 (FR-AUTH-047–049) — the read-only, unscoped counterpart to
// adminUsers.api.test.ts: GET /api/admin/user-directory lists every account
// (buyer + admin), not just the three admin roles. Bootstrap copied verbatim
// from adminUsers.api.test.ts's own established convention — real session
// state, real DB, rbac.ts can't be trusted against mocks.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

let mongod: MongoMemoryServer;
let mongoose: typeof mongooseType;
let app: Express;
let provisionAdminUser: typeof import("../../../src/scripts/seed/createAdminUser.js").provisionAdminUser;

const SUPER_ADMIN_EMAIL = "super-admin-directory@example.com";
const SUPER_ADMIN_PASSWORD = "Sup3rSecret!Pass";
const CATALOG_MANAGER_EMAIL = "catalog-manager-directory@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";

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

async function clearAuthCollections() {
  await mongoose.connection.db!.collection("users").deleteMany({});
  await mongoose.connection.db!.collection("userAuth").deleteMany({});
}

async function signInFully(email: string, password: string): Promise<string> {
  const agent = request.agent(app);
  const passwordRes = await agent.post("/api/auth/sign-in/email").send({ email, password });
  expect(passwordRes.status).toBe(200);

  await agent.post("/api/auth/two-factor/send-otp").send({});
  const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });
  expect(verify.status).toBe(200);

  const token = verify.headers["set-auth-token"] as string;
  expect(token).toBeTruthy();
  return token;
}

function adminRequest(method: "get", url: string, token: string) {
  return request(app)[method](url).set("Authorization", `Bearer ${token}`);
}

async function insertBuyer(email: string, name: string) {
  await mongoose.connection.db!.collection("users").insertOne({
    _id: new mongoose.Types.ObjectId(),
    name,
    email,
    isVerified: true,
    role: "buyer",
    status: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

let superAdminToken: string;

beforeEach(async () => {
  await clearAuthCollections();

  await provisionAdminUser({
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    name: "Super Admin Fixture",
    role: "super-admin",
  });
  superAdminToken = await signInFully(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/user-directory (FR-AUTH-047–049)", () => {
  it("lists buyers and admins together", async () => {
    await insertBuyer("directory-buyer@example.com", "Directory Buyer");
    await provisionAdminUser({
      email: CATALOG_MANAGER_EMAIL,
      password: CATALOG_MANAGER_PASSWORD,
      name: "Catalog Manager Fixture",
      role: "catalog-manager",
    });

    const res = await adminRequest("get", "/api/admin/user-directory?limit=100", superAdminToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const roles = (res.body.data as Array<{ role: string }>).map((u) => u.role);
    expect(roles).toContain("buyer");
    expect(roles).toContain("super-admin");
    expect(roles).toContain("catalog-manager");
  });

  it("filters by role", async () => {
    await insertBuyer("filter-buyer@example.com", "Filter Buyer");

    const res = await adminRequest("get", "/api/admin/user-directory?role=buyer", superAdminToken);
    expect(res.status).toBe(200);
    expect(
      (res.body.data as Array<{ role: string }>).every((u) => u.role === "buyer"),
    ).toBe(true);
  });

  it("filters by search across name/email", async () => {
    await insertBuyer("searchable-name@example.com", "Very Unique Name");

    const res = await adminRequest(
      "get",
      "/api/admin/user-directory?search=Very Unique Name",
      superAdminToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].email).toBe("searchable-name@example.com");
  });

  it("never returns passwordHash for any account", async () => {
    await provisionAdminUser({
      email: CATALOG_MANAGER_EMAIL,
      password: CATALOG_MANAGER_PASSWORD,
      name: "Catalog Manager Fixture",
      role: "catalog-manager",
    });

    const res = await adminRequest("get", "/api/admin/user-directory?limit=100", superAdminToken);
    expect(res.status).toBe(200);
    for (const account of res.body.data as Array<{ passwordHash?: unknown }>) {
      expect(account.passwordHash).toBeUndefined();
    }
  });

  it("rejects a request with no session", async () => {
    const res = await request(app).get("/api/admin/user-directory");
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

    const res = await adminRequest("get", "/api/admin/user-directory", token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});
