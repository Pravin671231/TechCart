import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";

// Issue #258/M3.20 — the buyer-flow counterpart to
// cross-site-cookies.api.test.ts (which verifies the admin two-factor
// pending cookie in adminChallenge.ts). session.ts and adminChallenge.ts
// share the identical isCrossSiteDeployment gate, so this verifies the
// techcart_session cookie gets the same SameSite=None; Secure treatment
// once a buyer signs in under a cross-site (https) deployment.
//
// Its own file, not folded into auth.api.test.ts, for the same reason
// cross-site-cookies.api.test.ts is separate: it needs a genuinely
// different APP_BASE_URL (https, not the shared http://localhost:4000
// every other suite uses) — set here, before any dynamic import of
// @/lib/session (transitively pulled in via @/app), so @/config/env's
// module-level parse picks it up. Vitest isolates each test file's module
// registry, so this override can't leak into any other suite.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

let mongod: MongoMemoryServer;
let mongoose: typeof mongooseType;
let app: Express;

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
}, 60000);

afterAll(async () => {
  await mongoose?.disconnect();
  await mongod?.stop();
});

describe("cross-site buyer session cookie (Issue #258/M3.20)", () => {
  it("sets SameSite=None; Secure on the session cookie when APP_BASE_URL is https", async () => {
    const email = "cross-site-buyer@example.com";

    await request(app)
      .post("/api/auth/email-otp/send-verification-otp")
      .send({ email, type: "sign-in" });

    const { sendOtpEmail } = await import("../../../src/externalService/mailer.js");
    const otp = (sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;

    const res = await request(app).post("/api/auth/sign-in/email-otp").send({ email, otp });

    expect(res.status).toBe(200);

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeTruthy();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const sessionCookie = cookies.find((c: string) => /techcart_session/i.test(c));

    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie?.toLowerCase()).toContain("samesite=none");
    expect(sessionCookie?.toLowerCase()).toContain("secure");
  });
});
