// Issue #326 — the end-of-list sentinel + status row for infinite-scroll
// listings (home). `sentinelRef` is the callback ref from
// useInfiniteScrollSentinel; it must always be rendered while there could be
// more pages, so the observer has something to watch.
//
// The "loading more" state is no longer shown here as a spinner — Home appends
// skeleton cards into the grid itself (HomeProductGrid) for a smoother,
// no-layout-shift transition (Issue #345).
export function InfiniteScrollFooter({
  sentinelRef,
  hasNextPage,
  hasItems,
}: {
  sentinelRef: (element: HTMLElement | null) => void;
  hasNextPage: boolean;
  hasItems: boolean;
}) {
  return (
    <div
      ref={sentinelRef}
      className="flex items-center justify-center py-6 text-sm text-neutral-400"
      aria-live="polite"
    >
      {!hasNextPage && hasItems ? <span>You&rsquo;ve reached the end</span> : null}
    </div>
  );
}
