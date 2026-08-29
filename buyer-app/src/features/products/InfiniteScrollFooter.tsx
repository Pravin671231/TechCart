// Issue #326 — the end-of-list sentinel + status row for infinite-scroll
// listings (home, category). `sentinelRef` is the callback ref from
// useInfiniteScrollSentinel; it must always be rendered while there could be
// more pages, so the observer has something to watch.
export function InfiniteScrollFooter({
  sentinelRef,
  isLoadingMore,
  hasNextPage,
  hasItems,
}: {
  sentinelRef: (element: HTMLElement | null) => void;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  hasItems: boolean;
}) {
  return (
    <div
      ref={sentinelRef}
      className="flex items-center justify-center py-6 text-sm text-neutral-400"
      aria-live="polite"
    >
      {isLoadingMore ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600" />
          Loading more…
        </span>
      ) : !hasNextPage && hasItems ? (
        <span>You&rsquo;ve reached the end</span>
      ) : null}
    </div>
  );
}
