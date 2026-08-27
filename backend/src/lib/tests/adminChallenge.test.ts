import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import { clearAdminChallenge, issueAdminChallenge, readAdminChallenge } from "@/lib/adminChallenge";

// A minimal Response test double capturing res.cookie / res.clearCookie
// calls, plus a helper to turn a captured Set-Cookie into the Cookie header
// a follow-up request would send back.
function fakeRes() {
  const cookies: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const cleared: string[] = [];
  const res = {
    cookie: vi.fn((name: string, value: string, options: Record<string, unknown>) => {
      cookies.push({ name, value, options });
    }),
    clearCookie: vi.fn((name: string) => {
      cleared.push(name);
    }),
  } as unknown as Response;
  return { res, cookies, cleared };
}

function reqWithCookie(header: string | undefined): Request {
  return { headers: header === undefined ? {} : { cookie: header } } as unknown as Request;
}

describe("adminChallenge", () => {
  it("round-trips a challenge through the cookie", () => {
    const { res, cookies } = fakeRes();
    issueAdminChallenge(res, { userId: "admin-1" });

    const set = cookies[0]!;
    expect(set.name).toBe("techcart_admin_2fa");
    expect(set.options.httpOnly).toBe(true);

    const decoded = readAdminChallenge(reqWithCookie(`${set.name}=${set.value}`));
    expect(decoded).toEqual({ userId: "admin-1" });
  });

  it("returns null when no cookie is present", () => {
    expect(readAdminChallenge(reqWithCookie(undefined))).toBeNull();
  });

  it("returns null for a tampered / wrong-secret token", () => {
    const forged = jwt.sign({ typ: "admin-2fa" }, "wrong-secret", {
      algorithm: "HS256",
      subject: "admin-1",
      expiresIn: 600,
    });

    expect(readAdminChallenge(reqWithCookie(`techcart_admin_2fa=${forged}`))).toBeNull();
  });

  it("returns null for an expired token", () => {
    const expired = jwt.sign({ typ: "admin-2fa" }, env.JWT_SECRET, {
      algorithm: "HS256",
      subject: "admin-1",
      expiresIn: "-1s",
    });

    expect(readAdminChallenge(reqWithCookie(`techcart_admin_2fa=${expired}`))).toBeNull();
  });

  it("returns null for a token of the wrong type", () => {
    const wrongType = jwt.sign({ typ: "something-else" }, env.JWT_SECRET, {
      algorithm: "HS256",
      subject: "admin-1",
      expiresIn: 600,
    });

    expect(readAdminChallenge(reqWithCookie(`techcart_admin_2fa=${wrongType}`))).toBeNull();
  });

  it("uses sameSite=lax when APP_BASE_URL is not https (dev/test)", () => {
    // vitest.config.ts sets APP_BASE_URL to http://localhost:4000.
    const { res, cookies } = fakeRes();
    issueAdminChallenge(res, { userId: "admin-1" });

    expect(cookies[0]!.options.sameSite).toBe("lax");
    expect(cookies[0]!.options.secure).toBe(false);
  });

  it("clears the cookie by name", () => {
    const { res, cleared } = fakeRes();
    clearAdminChallenge(res);

    expect(cleared).toEqual(["techcart_admin_2fa"]);
  });
});
