import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  extractSessionToken: vi.fn(),
  verifySessionToken: vi.fn(),
}));

import { extractSessionToken, verifySessionToken } from "@/lib/session";
import { rbac, CATALOG_ADMIN_ROLES } from "../rbac";

function mockRequest(): Request {
  return { headers: {} } as Request;
}

const res = {} as Response;
const next = vi.fn() as unknown as NextFunction;

afterEach(() => {
  vi.clearAllMocks();
});

describe("rbac", () => {
  it("401s with UNAUTHENTICATED when the request carries no session token", async () => {
    vi.mocked(extractSessionToken).mockReturnValue(null);
    const req = mockRequest();

    await rbac(["super-admin"])(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: "UNAUTHENTICATED" }),
    );
    expect(verifySessionToken).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it("401s with UNAUTHENTICATED when the token is invalid", async () => {
    vi.mocked(extractSessionToken).mockReturnValue("bad.token");
    vi.mocked(verifySessionToken).mockResolvedValue({ ok: false, reason: "invalid_token" });
    const req = mockRequest();

    await rbac(["super-admin"])(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: "UNAUTHENTICATED" }),
    );
    expect(req.user).toBeUndefined();
  });

  it("401s with UNAUTHENTICATED when the session is expired or revoked", async () => {
    vi.mocked(extractSessionToken).mockReturnValue("stale.token");
    vi.mocked(verifySessionToken).mockResolvedValue({ ok: false, reason: "session_expired" });
    const req = mockRequest();

    await rbac(["super-admin"])(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: "UNAUTHENTICATED" }),
    );
    expect(req.user).toBeUndefined();
  });

  it("403s with FORBIDDEN when the session's role isn't in the allowed list", async () => {
    vi.mocked(extractSessionToken).mockReturnValue("good.token");
    vi.mocked(verifySessionToken).mockResolvedValue({
      ok: true,
      userId: "user-1",
      role: "order-manager",
      jti: "jti-1",
    });
    const req = mockRequest();

    await rbac(["catalog-manager", "super-admin"])(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
    expect(req.user).toBeUndefined();
  });

  it("attaches req.user and calls next() with no error when the role is allowed", async () => {
    vi.mocked(extractSessionToken).mockReturnValue("good.token");
    vi.mocked(verifySessionToken).mockResolvedValue({
      ok: true,
      userId: "user-1",
      role: "catalog-manager",
      jti: "jti-1",
    });
    const req = mockRequest();

    await rbac(CATALOG_ADMIN_ROLES)(req, res, next);

    expect(req.user).toEqual({ id: "user-1", role: "catalog-manager" });
    expect(next).toHaveBeenCalledWith();
  });

  it("accepts any role named in a multi-role allow-list", async () => {
    vi.mocked(extractSessionToken).mockReturnValue("good.token");
    vi.mocked(verifySessionToken).mockResolvedValue({
      ok: true,
      userId: "user-2",
      role: "super-admin",
      jti: "jti-2",
    });
    const req = mockRequest();

    await rbac(CATALOG_ADMIN_ROLES)(req, res, next);

    expect(req.user).toEqual({ id: "user-2", role: "super-admin" });
    expect(next).toHaveBeenCalledWith();
  });
});
