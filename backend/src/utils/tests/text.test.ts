import { describe, expect, it } from "vitest";
import { truncate, escapeRegExp } from "../text";

describe("truncate", () => {
  it("returns the text unchanged when shorter than maxLength", () => {
    expect(truncate("Short description.", 160)).toBe("Short description.");
  });

  it("returns the text unchanged when exactly maxLength", () => {
    const text = "x".repeat(160);
    expect(truncate(text, 160)).toBe(text);
  });

  it("cuts at the last word boundary before maxLength and appends an ellipsis", () => {
    const text = `${"word ".repeat(40)}overflow`;
    const result = truncate(text, 30);

    expect(result.length).toBeLessThanOrEqual(33);
    expect(result.endsWith("...")).toBe(true);
    expect(result).not.toContain("overflow");
  });

  it("falls back to a hard cut when there is no space before maxLength", () => {
    const text = "a".repeat(50);
    const result = truncate(text, 10);

    expect(result).toBe(`${"a".repeat(10)}...`);
  });

  it("defaults maxLength to 160", () => {
    const text = "a".repeat(200);
    expect(truncate(text)).toBe(`${"a".repeat(160)}...`);
  });
});

describe("escapeRegExp", () => {
  it("leaves plain alphanumeric text unchanged", () => {
    expect(escapeRegExp("SKU-1")).toBe("SKU-1");
  });

  it("escapes every regex metacharacter so it matches literally", () => {
    const metacharacters = ".*+?^${}()|[]\\";
    const escaped = escapeRegExp(metacharacters);

    expect(new RegExp(`^${escaped}$`).test(metacharacters)).toBe(true);
  });

  it("prevents a malicious search term from being interpreted as a pattern", () => {
    // A search string containing regex syntax (e.g. an unanchored ".*")
    // must be treated as literal text, not as a pattern that matches
    // everything.
    const escaped = escapeRegExp("a.*b");
    expect(new RegExp(escaped).test("aXXXb")).toBe(false);
    expect(new RegExp(escaped).test("a.*b")).toBe(true);
  });
});
