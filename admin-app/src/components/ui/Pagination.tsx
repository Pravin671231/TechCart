import type { Pagination as PaginationData } from "@/app/api/api.types";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  pagination: PaginationData;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

type PageEntry = number | "ellipsis";

function getPageNumbers(current: number, total: number): PageEntry[] {
  const entries: PageEntry[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) entries.push("ellipsis");
  for (let page = left; page <= right; page++) entries.push(page);
  if (right < total - 1) entries.push("ellipsis");
  if (total > 1) entries.push(total);

  return entries;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const Pagination = ({
  page,
  pagination,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: PaginationProps) => {
  if (pagination.total === 0) return null;

  const pageNumbers = pagination.totalPages > 1 ? getPageNumbers(page, pagination.totalPages) : [];

  return (
    <div
      className={cn(
        "mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <p className={cn("text-neutral-500")}>
        Showing {(pagination.page - 1) * pagination.limit + 1}–
        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
      </p>

      {pageNumbers.length > 0 && (
        <nav aria-label="Pagination" className={cn("flex flex-wrap items-center gap-1")}>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={cn(
              "rounded-md border border-neutral-200 px-3 py-1 text-neutral-500 disabled:cursor-not-allowed disabled:text-neutral-300",
            )}
          >
            ‹ Prev
          </button>
          {pageNumbers.map((entry, index) =>
            entry === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-2 text-neutral-400">
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
            disabled={!pagination.hasNextPage}
            className={cn(
              "rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300",
            )}
          >
            Next ›
          </button>
        </nav>
      )}

      {onPageSizeChange && (
        <label className={cn("flex items-center gap-1.5 text-neutral-500")}>
          <span className="sr-only">Rows per page</span>
          <select
            value={pageSize ?? pagination.limit}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className={cn(
              "rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700",
            )}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};
