import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes a password to something other than the plaintext", async () => {
    const hash = await hashPassword("Sup3rSecret!Pass");

    expect(hash).not.toBe("Sup3rSecret!Pass");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("Sup3rSecret!Pass");

    expect(await verifyPassword("Sup3rSecret!Pass", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Sup3rSecret!Pass");

    expect(await verifyPassword("not-the-password", hash)).toBe(false);
  });

  it("produces a different hash each time (per-hash salt)", async () => {
    const a = await hashPassword("same-input");
    const b = await hashPassword("same-input");

    expect(a).not.toBe(b);
    expect(await verifyPassword("same-input", a)).toBe(true);
    expect(await verifyPassword("same-input", b)).toBe(true);
  });
});
