import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// Issue #148/M3.10 — verifies the cross-site two-factor cookie fix in
// src/lib/auth.ts. admin-app (Vercel) is cross-domain from backend (Render),
// so the pending-2FA cookie Better Auth's own `twoFactor` plugin sets
// between /sign-in/email and /two-factor/verify-otp must be
// `SameSite=None; Secure` to survive a real cross-site fetch — otherwise
// it's silently dropped, since a `SameSite=Lax` cookie (Better Auth's
// default) is never sent on a cross-site request at all.
//
// This is its own file, not folded into admin-sign-in.api.test.ts, because
// it needs a genuinely different BETTER_AUTH_URL (https, not the shared
// http://localhost:4000 every other suite uses) — set here, before any
// dynamic import of @/lib/auth (transitively pulled in via @/app), so
// @/config/env's module-level parse picks it up. Vitest isolates each test
// file's module registry, so this override can't leak into any other
// suite — every other file keeps resolving BETTER_AUTH_URL from
// vitest.config.ts's shared test.env block untouched.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

let mongod: MongoMemoryServer;
let mongoose: typeof mongooseType;
let app: Express;
let provisionAdminUser: typeof import("../../../src/scripts/seed/createAdminUser.js").provisionAdminUser;

const ADMIN_EMAIL = "cross-site-cookie-admin@example.com";
const ADMIN_PASSWORD = "Sup3rSecret!Pass";

beforeAll(async () => {
  process.env.BETTER_AUTH_URL = "https://techcart-backend.example.onrender.com";

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

  await provisionAdminUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: "Cross Site Cookie Admin",
    role: "catalog-manager",
  });
}, 60000);

afterAll(async () => {
  await mongoose?.disconnect();
  await mongod?.stop();
});

describe("cross-site two-factor cookie (Issue #148/M3.10)", () => {
  it("sets SameSite=None; Secure on the pending two-factor cookie when BETTER_AUTH_URL is https", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data?.code).toBe("OTP_REQUIRED");

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeTruthy();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const twoFactorCookie = cookies.find((c: string) => /two_factor/i.test(c));

    expect(twoFactorCookie).toBeTruthy();
    expect(twoFactorCookie?.toLowerCase()).toContain("samesite=none");
    expect(twoFactorCookie?.toLowerCase()).toContain("secure");
  });
});
