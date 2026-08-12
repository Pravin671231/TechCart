import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the initial value before the delay elapses", () => {
    const { result } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });

    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");
  });

  it("updates to the latest value once the delay elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("ab");
  });

  it("coalesces rapid changes into a single update using only the final value", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "z" },
    });

    rerender({ value: "ze" });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: "zen" });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("z");

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("zen");
  });
});
