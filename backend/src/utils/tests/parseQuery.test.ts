import { describe, expect, it } from "vitest";
import { parseQuery } from "../parseQuery";

type Field = "createdAt" | "name";
const FIELDS: readonly Field[] = ["createdAt", "name"];

describe("parseQuery", () => {
  it("computes {field, order: 1} for orderBy: asc", () => {
    const result = parseQuery<Field>(undefined, { page: 1, limit: 20 }, "name", "asc", FIELDS);
    expect(result.sort).toEqual({ field: "name", order: 1 });
  });

  it("computes {field, order: -1} for orderBy: desc", () => {
    const result = parseQuery<Field>(undefined, { page: 1, limit: 20 }, "name", "desc", FIELDS);
    expect(result.sort).toEqual({ field: "name", order: -1 });
  });

  it("omits sort when orderBy is none", () => {
    const result = parseQuery<Field>(undefined, { page: 1, limit: 20 }, "name", "none", FIELDS);
    expect(result.sort).toBeUndefined();
  });

  it("omits sort when sortBy is undefined", () => {
    const result = parseQuery<Field>(undefined, { page: 1, limit: 20 }, undefined, "asc", FIELDS);
    expect(result.sort).toBeUndefined();
  });

  it("defensively omits sort when sortBy isn't in the allow-listed field list", () => {
    const result = parseQuery(
      undefined,
      { page: 1, limit: 20 },
      "badField",
      "asc",
      FIELDS as readonly string[],
    );
    expect(result.sort).toBeUndefined();
  });

  it("merges search into an escaped $or filter across the given fields", () => {
    const result = parseQuery<Field>(
      { value: "a.*b", fields: ["name"] },
      { page: 1, limit: 20 },
      undefined,
      "none",
      FIELDS,
    );
    expect(result.filter).toEqual({
      $or: [{ name: { $regex: "a\\.\\*b", $options: "i" } }],
    });
  });

  it("supports multiple search fields", () => {
    const result = parseQuery<Field>(
      { value: "abc", fields: ["name", "sku"] },
      { page: 1, limit: 20 },
      undefined,
      "none",
      FIELDS,
    );
    expect(result.filter).toEqual({
      $or: [
        { name: { $regex: "abc", $options: "i" } },
        { sku: { $regex: "abc", $options: "i" } },
      ],
    });
  });

  it("leaves the filter unchanged when no search is given", () => {
    const result = parseQuery<Field>(
      undefined,
      { page: 1, limit: 20 },
      undefined,
      "none",
      FIELDS,
      { status: "published" },
    );
    expect(result.filter).toEqual({ status: "published" });
  });

  it("preserves the caller's filter alongside a search-derived $or", () => {
    const result = parseQuery<Field>(
      { value: "nov", fields: ["name"] },
      { page: 1, limit: 20 },
      undefined,
      "none",
      FIELDS,
      { status: "published" },
    );
    expect(result.filter).toEqual({
      status: "published",
      $or: [{ name: { $regex: "nov", $options: "i" } }],
    });
  });

  it("passes page/limit through unchanged, including an oversized limit", () => {
    const result = parseQuery<Field>(
      undefined,
      { page: 3, limit: 1000 },
      undefined,
      "none",
      FIELDS,
    );
    expect(result.page).toBe(3);
    expect(result.limit).toBe(1000);
  });
});
