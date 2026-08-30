import { describe, expect, it } from "vitest";
import { planStockForIndex } from "../inventory";

describe("planStockForIndex", () => {
  it("marks every 10th index fully out of stock", () => {
    expect(planStockForIndex(0)).toEqual({ primary: 0, secondary: 0, returns: 0 });
    expect(planStockForIndex(10)).toEqual({ primary: 0, secondary: 0, returns: 0 });
  });

  it("stocks only the secondary warehouse on index%10===1", () => {
    const plan = planStockForIndex(1);
    expect(plan.primary).toBe(0);
    expect(plan.secondary).toBeGreaterThan(0);
    expect(plan.returns).toBe(0);
  });

  it("stocks only the returns warehouse on index%10===2", () => {
    const plan = planStockForIndex(2);
    expect(plan.primary).toBe(0);
    expect(plan.secondary).toBe(0);
    expect(plan.returns).toBeGreaterThan(0);
  });

  it("stocks every warehouse for the normal case", () => {
    const plan = planStockForIndex(3);
    expect(plan.primary).toBeGreaterThan(0);
    expect(plan.secondary).toBeGreaterThan(0);
    expect(plan.returns).toBeGreaterThan(0);
  });

  it("is deterministic for the same index", () => {
    expect(planStockForIndex(42)).toEqual(planStockForIndex(42));
  });
});
