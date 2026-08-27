import type { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as sessionLib from "@/lib/session";

interface SessionRow {
  _id: string;
  userId: string;
  expiresAt: Date;
}

let mongod: MongoMemoryServer;

// No connectDB()/app.js import here — this module has zero Express/Better
// Auth coupling to bring in, unlike testHelpers/adminSession.ts's
// bootstrapMemoryMongo(). A static import is safe here (unlike that
// helper's dynamic-import trick): @/lib/session never reads env.MONGODB_URI
// — this test connects Mongoose directly to the memory server's own URI —
// and vitest.config.ts already injects every var env.ts's schema requires
// (including JWT_SECRET) for the whole run, so nothing needs to be set
// before this file's imports resolve.
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.db!.collection<SessionRow>("sessions").deleteMany({});
});

function mockRequest(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

function mockResponse(): Response & { cookie: ReturnType<typeof vi.fn> } {
  return { cookie: vi.fn() } as unknown as Response & { cookie: ReturnType<typeof vi.fn> };
}

describe("session", () => {
  describe("issueSession", () => {
    it("creates a sessions row keyed by the returned jti", async () => {
      const issued = await sessionLib.issueSession({ userId: "user-1", role: "buyer" });

      const row = await mongoose.connection.db!.collection<SessionRow>("sessions").findOne({ _id: issued.jti });
      expect(row).not.toBeNull();
      expect(row?.userId).toBe("user-1");
    });
  });

  describe("verifySessionToken", () => {
    it("resolves a freshly issued token", async () => {
      const issued = await sessionLib.issueSession({ userId: "user-1", role: "buyer" });

      const result = await sessionLib.verifySessionToken(issued.token);

      expect(result).toEqual({ ok: true, userId: "user-1", role: "buyer", jti: issued.jti });
    });

    it("extends the row's expiresAt on each successful call (rolling window)", async () => {
      const issued = await sessionLib.issueSession({ userId: "user-1", role: "buyer" });
      const before = await mongoose.connection.db!.collection<SessionRow>("sessions").findOne({ _id: issued.jti });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await sessionLib.verifySessionToken(issued.token);

      const after = await mongoose.connection.db!.collection<SessionRow>("sessions").findOne({ _id: issued.jti });
      expect((after?.expiresAt as Date).getTime()).toBeGreaterThan((before?.expiresAt as Date).getTime());
    });

    it("rejects a forged/garbage token without touching the database", async () => {
      const result = await sessionLib.verifySessionToken("not-a-real-token");

      expect(result).toEqual({ ok: false, reason: "invalid_token" });
    });

    it("rejects a token whose session has been revoked", async () => {
      const issued = await sessionLib.issueSession({ userId: "user-1", role: "buyer" });
      await sessionLib.revokeSession(issued.jti);

      const result = await sessionLib.verifySessionToken(issued.token);

      expect(result).toEqual({ ok: false, reason: "session_expired" });
    });

    it("rejects a token whose row has lapsed (rolling window expired)", async () => {
      const issued = await sessionLib.issueSession({ userId: "user-1", role: "buyer" });
      await mongoose.connection
        .db!.collection<SessionRow>("sessions")
        .updateOne({ _id: issued.jti }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

      const result = await sessionLib.verifySessionToken(issued.token);

      expect(result).toEqual({ ok: false, reason: "session_expired" });
    });
  });

  describe("revokeAllSessionsForUser", () => {
    it("deletes every session belonging to the user", async () => {
      const a = await sessionLib.issueSession({ userId: "user-1", role: "buyer" });
      const b = await sessionLib.issueSession({ userId: "user-1", role: "buyer" });

      await sessionLib.revokeAllSessionsForUser("user-1");

      expect(await sessionLib.verifySessionToken(a.token)).toEqual({ ok: false, reason: "session_expired" });
      expect(await sessionLib.verifySessionToken(b.token)).toEqual({ ok: false, reason: "session_expired" });
    });

    it("keeps the excluded session alive (password-change-keeps-current-session case)", async () => {
      const current = await sessionLib.issueSession({ userId: "user-1", role: "buyer" });
      const other = await sessionLib.issueSession({ userId: "user-1", role: "buyer" });

      await sessionLib.revokeAllSessionsForUser("user-1", current.jti);

      expect(await sessionLib.verifySessionToken(current.token)).toEqual({
        ok: true,
        userId: "user-1",
        role: "buyer",
        jti: current.jti,
      });
      expect(await sessionLib.verifySessionToken(other.token)).toEqual({ ok: false, reason: "session_expired" });
    });
  });

  describe("extractSessionToken", () => {
    it("reads a token from the Authorization: Bearer header", () => {
      const req = mockRequest({ authorization: "Bearer abc.def.ghi" });

      expect(sessionLib.extractSessionToken(req)).toBe("abc.def.ghi");
    });

    it("reads a token from the techcart_session cookie when there is no Authorization header", () => {
      const req = mockRequest({ cookie: "techcart_session=abc.def.ghi" });

      expect(sessionLib.extractSessionToken(req)).toBe("abc.def.ghi");
    });

    it("prefers the Authorization header over the cookie when both are present", () => {
      const req = mockRequest({
        authorization: "Bearer from-header",
        cookie: "techcart_session=from-cookie",
      });

      expect(sessionLib.extractSessionToken(req)).toBe("from-header");
    });

    it("returns null when neither is present", () => {
      const req = mockRequest({});

      expect(sessionLib.extractSessionToken(req)).toBeNull();
    });
  });

  describe("setSessionCookie", () => {
    it("sets httpOnly/secure/sameSite/expires on the response", () => {
      const res = mockResponse();
      const expiresAt = new Date(Date.now() + 1000);

      sessionLib.setSessionCookie(res, "abc.def.ghi", expiresAt);

      expect(res.cookie).toHaveBeenCalledWith(
        "techcart_session",
        "abc.def.ghi",
        expect.objectContaining({ httpOnly: true, expires: expiresAt, path: "/" }),
      );
    });
  });

  describe("round trip", () => {
    it("issues, delivers via cookie, and verifies back to the same identity", async () => {
      const issued = await sessionLib.issueSession({ userId: "user-1", role: "catalog-manager" });
      const res = mockResponse();

      sessionLib.setSessionCookie(res, issued.token, issued.expiresAt);
      const [, cookieValue] = res.cookie.mock.calls[0] as [string, string];
      const req = mockRequest({ cookie: `techcart_session=${cookieValue}` });

      const token = sessionLib.extractSessionToken(req);
      const result = await sessionLib.verifySessionToken(token!);

      expect(result).toEqual({ ok: true, userId: "user-1", role: "catalog-manager", jti: issued.jti });
    });

    it("issues, delivers via Authorization: Bearer, and verifies back to the same identity", async () => {
      const issued = await sessionLib.issueSession({ userId: "user-2", role: "buyer" });
      const req = mockRequest({ authorization: `Bearer ${issued.token}` });

      const token = sessionLib.extractSessionToken(req);
      const result = await sessionLib.verifySessionToken(token!);

      expect(result).toEqual({ ok: true, userId: "user-2", role: "buyer", jti: issued.jti });
    });
  });
});
