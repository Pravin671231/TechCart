import { describe, expect, it } from "vitest";
import { resolveDateRange, resolveBucket, generateBucketKeys } from "@/utils/dateRange";
import { AppError } from "@/utils/AppError";

describe("resolveDateRange", () => {
  it("defaults to the last 30 days when both from/to are omitted", () => {
    const range = resolveDateRange();
    const diffDays = (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it("rejects a reversed range", () => {
    expect(() => resolveDateRange("2026-02-01", "2026-01-01")).toThrow(AppError);
  });

  it("rejects a range spanning more than a year", () => {
    expect(() => resolveDateRange("2024-01-01", "2026-06-01")).toThrow(AppError);
  });

  it("rejects an unparseable date", () => {
    expect(() => resolveDateRange("not-a-date", "2026-01-01")).toThrow(AppError);
  });

  it("accepts a valid explicit range", () => {
    const range = resolveDateRange("2026-01-01", "2026-01-31");
    expect(range.from.toISOString().startsWith("2026-01-01")).toBe(true);
    expect(range.to.toISOString().startsWith("2026-01-31")).toBe(true);
  });
});

describe("resolveBucket", () => {
  it("buckets a <=31 day range by day", () => {
    const range = resolveDateRange("2026-01-01", "2026-01-20");
    expect(resolveBucket(range)).toBe("day");
  });

  it("buckets a >31 day range by week", () => {
    const range = resolveDateRange("2026-01-01", "2026-04-01");
    expect(resolveBucket(range)).toBe("week");
  });
});

describe("generateBucketKeys", () => {
  it("generates one key per day for a day bucket", () => {
    const range = resolveDateRange("2026-01-01", "2026-01-03");
    const keys = generateBucketKeys(range, "day");
    expect(keys).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("generates week keys with no duplicates for a week bucket", () => {
    const range = resolveDateRange("2026-01-01", "2026-01-20");
    const keys = generateBucketKeys(range, "week");
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(0);
  });
});
