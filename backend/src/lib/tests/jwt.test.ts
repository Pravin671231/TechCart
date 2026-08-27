import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { signSessionJwt, verifySessionJwt } from "@/lib/jwt";

describe("jwt", () => {
  it("round-trips a signed token back to its original payload", () => {
    const token = signSessionJwt({ sub: "user-1", role: "buyer", jti: "jti-1" });

    const decoded = verifySessionJwt(token);

    expect(decoded).toEqual({ sub: "user-1", role: "buyer", jti: "jti-1" });
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ role: "super-admin" }, "wrong-secret", {
      algorithm: "HS256",
      subject: "user-1",
      jwtid: "jti-1",
      expiresIn: "90d",
    });

    expect(verifySessionJwt(forged)).toBeNull();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ role: "buyer" }, env.JWT_SECRET, {
      algorithm: "HS256",
      subject: "user-1",
      jwtid: "jti-1",
      expiresIn: "-1s",
    });

    expect(verifySessionJwt(expired)).toBeNull();
  });

  it("rejects a malformed token string", () => {
    expect(verifySessionJwt("not-a-jwt")).toBeNull();
  });

  it("rejects a token missing a required claim", () => {
    const missingRole = jwt.sign({}, env.JWT_SECRET, {
      algorithm: "HS256",
      subject: "user-1",
      jwtid: "jti-1",
      expiresIn: "90d",
    });

    expect(verifySessionJwt(missingRole)).toBeNull();
  });
});
