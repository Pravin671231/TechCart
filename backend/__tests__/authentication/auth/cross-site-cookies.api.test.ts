import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// Issue #259/M3.21 (was #148/M3.10) — verifies the cross-site pending-2FA
// cookie fix in src/lib/adminChallenge.ts. admin-app (Vercel) is cross-domain
// from backend (Render), so the `techcart_admin_2fa` cookie set between
// /sign-in/email and /two-factor/verify-otp must be `SameSite=None; Secure`
// to survive a real cross-site fetch — otherwise it's silently dropped, since
// a `SameSite=Lax` cookie is never sent on a cross-site request at all.
//
// This is its own file, not folded into admin-sign-in.api.test.ts, because
// it needs a genuinely different APP_BASE_URL (https, not the shared
// http://localhost:4000 every other suite uses) — set here, before any
// dynamic import of @/config/env (transitively pulled in via @/app), so its
// module-level parse picks it up. Vitest isolates each test file's module
// registry, so this override can't leak into any other suite.
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
  process.env.APP_BASE_URL = "https://techcart-backend.example.onrender.com";

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

describe("cross-site pending-2FA cookie (Issue #259/M3.21)", () => {
  it("sets SameSite=None; Secure on the challenge cookie when APP_BASE_URL is https", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data?.code).toBe("OTP_REQUIRED");

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeTruthy();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const challengeCookie = cookies.find((c: string) => /techcart_admin_2fa/i.test(c));

    expect(challengeCookie).toBeTruthy();
    expect(challengeCookie?.toLowerCase()).toContain("samesite=none");
    expect(challengeCookie?.toLowerCase()).toContain("secure");
  });
});
