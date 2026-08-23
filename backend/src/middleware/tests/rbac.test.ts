import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
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
  it("401s with UNAUTHENTICATED when there is no session at all", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = mockRequest();

    await rbac(["super-admin"])(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: "UNAUTHENTICATED" }),
    );
    expect(req.user).toBeUndefined();
  });

  it("403s with FORBIDDEN when the session's role isn't in the allowed list", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      session: {} as never,
      user: { id: "user-1", role: "order-manager" } as never,
    });
    const req = mockRequest();

    await rbac(["catalog-manager", "super-admin"])(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
    expect(req.user).toBeUndefined();
  });

  it("attaches req.user and calls next() with no error when the role is allowed", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      session: {} as never,
      user: { id: "user-1", role: "catalog-manager" } as never,
    });
    const req = mockRequest();

    await rbac(CATALOG_ADMIN_ROLES)(req, res, next);

    expect(req.user).toEqual({ id: "user-1", role: "catalog-manager" });
    expect(next).toHaveBeenCalledWith();
  });

  it("accepts any role named in a multi-role allow-list", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      session: {} as never,
      user: { id: "user-2", role: "super-admin" } as never,
    });
    const req = mockRequest();

    await rbac(CATALOG_ADMIN_ROLES)(req, res, next);

    expect(req.user).toEqual({ id: "user-2", role: "super-admin" });
    expect(next).toHaveBeenCalledWith();
  });
});
