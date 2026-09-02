import { cn } from "@/lib/utils";
import { getPageWindow } from "./utils";

interface DataTablePaginationProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

/**
 * Windowed numbered pager — the centre zone of `DataTableFooter`. Arrow-only
 * prev/next plus first / last / current ±1 page buttons with `"…"` for the gaps.
 * Purely presentational; no dependency on any app-level pagination component.
 */
export const DataTablePagination = ({
  page,
  pageCount,
  onPageChange,
}: DataTablePaginationProps) => {
  const window = getPageWindow(page, pageCount);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-neutral-200 px-2 py-1 text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
      >
        ‹
      </button>

      {window.map((entry, index) =>
        entry === "ellipsis" ? (
          <span key={`gap-${index}`} className="px-1.5 text-neutral-400">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            aria-current={entry === page ? "page" : undefined}
            onClick={() => onPageChange(entry)}
            className={cn(
              "min-w-8 rounded-md border px-2 py-1",
              entry === page
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
            )}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        className="rounded-md border border-neutral-200 px-2 py-1 text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
      >
        ›
      </button>
    </nav>
  );
};
