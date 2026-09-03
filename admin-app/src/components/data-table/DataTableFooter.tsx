import { DataTablePagination } from "./DataTablePagination";
import { getPageCount, getRangeLabel } from "./utils";
import type { DataTablePaginationState } from "./types";

interface DataTableFooterProps {
  pagination?: DataTablePaginationState;
  onPaginationChange?: (next: { page: number; pageSize: number }) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Fixed footer below the scroll area.
 *
 * Desktop:
 *   range          pagination          page size
 *
 * Mobile:
 *   range                              page size
 *
 * Numbered pagination is hidden below md.
 */
export const DataTableFooter = ({
  pagination,
  onPaginationChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: DataTableFooterProps) => {
  if (!pagination) return null;

  const pageCount = getPageCount(
    pagination.total,
    pagination.pageSize
  );

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-600 bg-white px-3 py-2 text-sm text-neutral-500">
      {/* Record range */}
      <span className="whitespace-nowrap">
        Showing {getRangeLabel(pagination)}
      </span>

      {/* Pagination - hidden on mobile */}
      {onPaginationChange && (
        <div className="hidden md:flex">
          <DataTablePagination
            page={pagination.page}
            pageCount={pageCount}
            onPageChange={(page) =>
              onPaginationChange({
                page,
                pageSize: pagination.pageSize,
              })
            }
          />
        </div>
      )}

      {/* Page size */}
      {onPaginationChange && (
        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">Rows per page</span>

          <select
            value={pagination.pageSize}
            onChange={(event) =>
              onPaginationChange({
                page: 1,
                pageSize: Number(event.target.value),
              })
            }
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
