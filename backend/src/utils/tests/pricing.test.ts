import { describe, expect, it } from "vitest";
import { computeSellingPrice } from "../pricing";

describe("computeSellingPrice", () => {
  it("computes mrp minus the floored discount amount", () => {
    expect(computeSellingPrice(99900, 10)).toBe(89910);
  });

  it("returns mrp unchanged when discount is 0", () => {
    expect(computeSellingPrice(50000, 0)).toBe(50000);
  });

  it("floors a fractional discount amount rather than rounding", () => {
    // 10000 * 33 / 100 = 3300 exactly, but 9999 * 33 / 100 = 3299.67
    expect(computeSellingPrice(9999, 33)).toBe(9999 - 3299);
  });

  it("never reaches 0 given the FR-CAT-086 discount bound of 99", () => {
    expect(computeSellingPrice(100, 99)).toBe(1);
  });
});
