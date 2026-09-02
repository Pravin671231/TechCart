import { cn } from "@/lib/utils";
import { getPageCount, getPageWindow } from "./utils";

interface DataTablePaginationProps {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Rendered only when provided. */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Self-contained numeric pager — no dependency on any app-level Pagination
 * component. Purely presentational: it reflects `page`/`pageSize`/`total` and
 * emits change intents.
 */
export const DataTablePagination = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: DataTablePaginationProps) => {
  const pageCount = getPageCount(total, pageSize);
  const window = getPageWindow(page, pageCount);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-neutral-200 px-2.5 py-1 text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
      >
        ‹ Prev
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
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        className="rounded-md border border-neutral-200 px-2.5 py-1 text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
      >
        Next ›
      </button>

      {onPageSizeChange && (
        <label className="ml-2 flex items-center gap-1.5 text-neutral-500">
          <span className="sr-only">Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};
