import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrSetCache, resetDashboardCache } from "@/lib/cache";

afterEach(() => {
  resetDashboardCache();
});

describe("getOrSetCache", () => {
  it("computes and returns a fresh value on a cache miss", async () => {
    const compute = vi.fn().mockResolvedValue({ value: 42 });
    const result = await getOrSetCache("test:key:1", 60, compute);
    expect(result).toEqual({ value: 42 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("returns the cached value on a second call within the TTL, without recomputing", async () => {
    const compute = vi.fn().mockResolvedValue({ value: 1 });
    await getOrSetCache("test:key:2", 60, compute);
    const second = await getOrSetCache("test:key:2", 60, compute);
    expect(second).toEqual({ value: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("recomputes once the TTL has elapsed", async () => {
    const compute = vi.fn().mockResolvedValueOnce({ value: 1 }).mockResolvedValueOnce({ value: 2 });
    await getOrSetCache("test:key:3", 0, compute);
    // TTL of 0 seconds — already expired by the time of the second call.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await getOrSetCache("test:key:3", 0, compute);
    expect(second).toEqual({ value: 2 });
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
