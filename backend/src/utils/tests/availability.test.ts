import { describe, expect, it } from "vitest";
import { deriveAvailability, bestAvailability } from "../availability";

describe("deriveAvailability", () => {
  it("reports out_of_stock when stock is zero", () => {
    expect(deriveAvailability(0, 5)).toBe("out_of_stock");
  });

  it("reports out_of_stock for negative stock", () => {
    expect(deriveAvailability(-1, 5)).toBe("out_of_stock");
  });

  it("reports low_stock when stock is below the threshold", () => {
    expect(deriveAvailability(3, 5)).toBe("low_stock");
  });

  it("reports low_stock when stock exactly equals the threshold (inclusive boundary)", () => {
    expect(deriveAvailability(5, 5)).toBe("low_stock");
  });

  it("reports in_stock when stock is above the threshold", () => {
    expect(deriveAvailability(6, 5)).toBe("in_stock");
  });

  it("never reports low_stock when the threshold is zero", () => {
    expect(deriveAvailability(1, 0)).toBe("in_stock");
    expect(deriveAvailability(0, 0)).toBe("out_of_stock");
  });
});

describe("bestAvailability", () => {
  it("returns out_of_stock for an empty list", () => {
    expect(bestAvailability([])).toBe("out_of_stock");
  });

  it("returns in_stock if any state is in_stock", () => {
    expect(bestAvailability(["out_of_stock", "low_stock", "in_stock"])).toBe("in_stock");
  });

  it("returns low_stock when the best state present is low_stock", () => {
    expect(bestAvailability(["out_of_stock", "low_stock"])).toBe("low_stock");
  });

  it("returns out_of_stock when every state is out_of_stock", () => {
    expect(bestAvailability(["out_of_stock", "out_of_stock"])).toBe("out_of_stock");
  });
});
