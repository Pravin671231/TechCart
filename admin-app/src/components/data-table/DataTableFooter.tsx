import { DataTablePagination } from "./DataTablePagination";
import { getRangeLabel } from "./utils";
import type { DataTablePaginationState } from "./types";

interface DataTableFooterProps {
  pagination?: DataTablePaginationState;
  onPaginationChange?: (next: { page: number; pageSize: number }) => void;
  pageSizeOptions?: number[];
  selectedCount: number;
}

/**
 * The fixed bar below the scroll area. It's pinned by the flex layout (a
 * `shrink-0` sibling after the `flex-1` scroll region), not by `position`.
 * Renders nothing when there's neither pagination nor an active selection.
 */
export const DataTableFooter = ({
  pagination,
  onPaginationChange,
  pageSizeOptions,
  selectedCount,
}: DataTableFooterProps) => {
  if (!pagination && selectedCount === 0) return null;

  const leftLabel =
    selectedCount > 0
      ? `${selectedCount} selected`
      : pagination
        ? `Showing ${getRangeLabel(pagination)}`
        : "";

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500">
      <span>{leftLabel}</span>

      {pagination && onPaginationChange && (
        <DataTablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={(page) => onPaginationChange({ page, pageSize: pagination.pageSize })}
          onPageSizeChange={(pageSize) => onPaginationChange({ page: 1, pageSize })}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
};
