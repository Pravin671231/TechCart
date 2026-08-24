import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import type mongooseType from "mongoose";
import type { Mock } from "vitest";
import request from "supertest";

// Shared real-DB test harness (Issue #143/M3.5) — extracted from
// __tests__/adminUsers/adminUsers.api.test.ts's own signInFully/adminRequest
// on their second real use (the six catalog Supertest suites this issue
// converts from X-Admin-Key to real-session auth are the third through
// eighth). Every catalog admin route is now gated by rbac.ts, which needs a
// real Better Auth session to resolve — these suites still mock each
// module's own repository layer, so this only adds a real Mongo connection
// for session resolution, not real catalog reads/writes.

export interface MemoryMongoContext {
  mongod: MongoMemoryServer;
  mongoose: typeof mongooseType;
  app: Express;
}

// Dynamic imports so MONGODB_URI is set (from the memory server's own URI)
// before @/config/env (validated at import time) or @/app are ever
// imported — same convention __tests__/auth/*, __tests__/adminUsers/*
// established.
export async function bootstrapMemoryMongo(): Promise<MemoryMongoContext> {
  const { MongoMemoryServer: MemoryServer } = await import("mongodb-memory-server");
  const mongod = await MemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  const mongoose = (await import("mongoose")).default;
  const { connectDB } = await import("../../src/config/db.js");
  await connectDB();

  const appModule = await import("../../src/app.js");
  const app = (appModule as unknown as { default: Express }).default;

  return { mongod, mongoose, app };
}

export async function teardownMemoryMongo(ctx: MemoryMongoContext): Promise<void> {
  await ctx.mongoose?.disconnect();
  await ctx.mongod?.stop();
}

export async function clearAuthCollections(mongoose: typeof mongooseType): Promise<void> {
  await mongoose.connection.db!.collection("users").deleteMany({});
  await mongoose.connection.db!.collection("account").deleteMany({});
  await mongoose.connection.db!.collection("verification").deleteMany({});
  await mongoose.connection.db!.collection("session").deleteMany({});
  await mongoose.connection.db!.collection("twoFactor").deleteMany({});
}

// Requires the calling test file to have already called
// vi.mock("@/externalService/mailer", () => ({ sendOtpEmail: vi.fn()... }))
// — reads the OTP back off that mock's most recent call, same as every
// other admin sign-in test in this codebase.
export async function signInFully(app: Express, email: string, password: string): Promise<string> {
  const agent = request.agent(app);
  const passwordRes = await agent.post("/api/auth/sign-in/email").send({ email, password });
  if (passwordRes.status !== 200) {
    throw new Error(
      `sign-in/email failed: ${passwordRes.status} ${JSON.stringify(passwordRes.body)}`,
    );
  }

  const send = await agent.post("/api/auth/two-factor/send-otp").send({});
  if (send.status !== 200) {
    throw new Error(`two-factor/send-otp failed: ${send.status}`);
  }

  // Issue #242/M3.14 — auth.ts's databaseHooks.verification.create.before
  // now forces every 2fa-otp-* verification record's stored value to
  // "123456:0" regardless of the real (random) code sendOtpEmail was
  // actually called with, so submitting that captured code would never
  // verify anymore. "123456" is the only value that ever succeeds now; the
  // mock-call check stays as a sanity check that send-otp really triggered
  // an email attempt.
  const { sendOtpEmail } = await import("../../src/externalService/mailer.js");
  if (!(sendOtpEmail as unknown as Mock).mock.calls.at(-1)) {
    throw new Error("sendOtpEmail was never called — is it mocked in this test file?");
  }

  const verify = await agent.post("/api/auth/two-factor/verify-otp").send({ code: "123456" });
  if (verify.status !== 200) {
    throw new Error(`two-factor/verify-otp failed: ${verify.status}`);
  }

  const token = verify.headers["set-auth-token"] as string;
  if (!token) throw new Error("No set-auth-token header on the verify-otp response");
  return token;
}

// Buyer counterpart to signInFully — email-OTP sign-in has no password/2FA
// step (that's admin-only), just send -> read the OTP off the mocked
// sendOtpEmail call -> verify. Requires the same
// vi.mock("@/externalService/mailer", ...) precondition as signInFully.
// Added on Issue #144/M3.6's first buyer-facing auth test in this shared
// helper file.
export async function signInBuyer(app: Express, email: string): Promise<string> {
  const send = await request(app)
    .post("/api/auth/email-otp/send-verification-otp")
    .send({ email, type: "sign-in" });
  if (send.status !== 200) {
    throw new Error(`email-otp/send-verification-otp failed: ${send.status}`);
  }

  const { sendOtpEmail } = await import("../../src/externalService/mailer.js");
  const otp = (sendOtpEmail as unknown as Mock).mock.calls.at(-1)?.[1] as string;
  if (!otp) throw new Error("sendOtpEmail was never called — is it mocked in this test file?");

  const verify = await request(app).post("/api/auth/sign-in/email-otp").send({ email, otp });
  if (verify.status !== 200) {
    throw new Error(`sign-in/email-otp failed: ${verify.status}`);
  }

  const token = verify.headers["set-auth-token"] as string;
  if (!token) throw new Error("No set-auth-token header on the sign-in/email-otp response");
  return token;
}

type Method = "get" | "post" | "patch" | "put" | "delete";

export function authRequest(app: Express, method: Method, url: string, token: string) {
  return request(app)[method](url).set("Authorization", `Bearer ${token}`);
}
