import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { triggerIntersection } from "../../vitest.setup";
import { useInfiniteScrollSentinel } from "@/hooks/useInfiniteScrollSentinel";

function Harness(props: { hasNextPage: boolean; isFetching: boolean; onLoadMore: () => void }) {
  const sentinelRef = useInfiniteScrollSentinel(props);
  return <div data-testid="sentinel" ref={sentinelRef} />;
}

describe("useInfiniteScrollSentinel", () => {
  it("calls onLoadMore when the sentinel intersects and there is a next page", async () => {
    const onLoadMore = vi.fn();
    render(<Harness hasNextPage isFetching={false} onLoadMore={onLoadMore} />);

    await act(async () => {
      triggerIntersection();
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not call onLoadMore while a fetch is in flight", async () => {
    const onLoadMore = vi.fn();
    render(<Harness hasNextPage isFetching onLoadMore={onLoadMore} />);

    await act(async () => {
      triggerIntersection();
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not call onLoadMore when there is no next page", async () => {
    const onLoadMore = vi.fn();
    render(<Harness hasNextPage={false} isFetching={false} onLoadMore={onLoadMore} />);

    await act(async () => {
      triggerIntersection();
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("guards against a burst of intersection events firing more than one load", async () => {
    const onLoadMore = vi.fn();
    render(<Harness hasNextPage isFetching={false} onLoadMore={onLoadMore} />);

    await act(async () => {
      triggerIntersection();
      triggerIntersection();
      triggerIntersection();
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
