import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_TTL, getOrSetCache, invalidateCache, resetCache } from "@/lib/cache";

describe("getOrSetCache", () => {
  beforeEach(() => {
    resetCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCache();
  });

  it("computes on a miss and returns the cached value on a hit", async () => {
    const compute = vi.fn().mockResolvedValue({ n: 1 });

    const first = await getOrSetCache("catalog:brand-list:public", CACHE_TTL.STANDARD, compute);
    const second = await getOrSetCache("catalog:brand-list:public", CACHE_TTL.STANDARD, compute);

    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 1 });
    expect(compute).toHaveBeenCalledOnce();
  });

  it("recomputes after the TTL expires", async () => {
    vi.useFakeTimers();
    const compute = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");

    expect(await getOrSetCache("k", 60, compute)).toBe("a");
    vi.advanceTimersByTime(61_000);
    expect(await getOrSetCache("k", 60, compute)).toBe("b");
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("does not cache a rejected computation", async () => {
    const compute = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");

    await expect(getOrSetCache("k", 60, compute)).rejects.toThrow("boom");
    expect(await getOrSetCache("k", 60, compute)).toBe("ok");
  });

  it("invalidateCache drops a single key", async () => {
    const compute = vi.fn().mockResolvedValue(1);

    await getOrSetCache("k", 60, compute);
    invalidateCache("k");
    await getOrSetCache("k", 60, compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });
});
