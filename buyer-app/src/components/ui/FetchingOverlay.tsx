import type { ReactNode } from "react";

// Wraps a list/content region so an RTK Query *subsequent* fetch (page,
// filter, sort, search — `isFetching && !isLoading`) keeps the previous
// content visible but dimmed, with a small "Updating…" indicator. The
// first-ever load still shows its own skeleton (gate that on `isLoading`
// before rendering into here). Buyer-app counterpart to admin-app's
// `components/ui/Table.tsx` `isFetching` treatment.
export function FetchingOverlay({
  isFetching,
  children,
}: {
  isFetching: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative" aria-busy={isFetching}>
      <div className={isFetching ? "opacity-50 transition-opacity" : undefined}>{children}</div>
      {isFetching && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-xs text-neutral-500 shadow-sm ring-1 ring-neutral-200"
        >
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Updating…
        </div>
      )}
    </div>
  );
}
