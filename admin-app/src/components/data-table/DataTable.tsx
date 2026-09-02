import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { DataTableBody } from "./DataTableBody";
import { DataTableFooter } from "./DataTableFooter";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableToolbar } from "./DataTableToolbar";
import { getBodyColSpan, getVisibleColumns, resolveColumnWidth } from "./utils";
import type { DataTableProps, DataTableState } from "./types";

/**
 * Reusable, generic, presentational data table.
 *
 * Layout: a `flex h-full min-h-0 flex-col` column — toolbar (`shrink-0`), a
 * single scrolling region (`flex-1 min-h-0 overflow-auto`) holding one `<table>`
 * with a `sticky` header, then a footer (`shrink-0`). Only the table body
 * scrolls. To fill the viewport, the CONSUMER must give `<DataTable>` a
 * bounded-height parent (a flex column with it as `flex-1`, or an explicit
 * height). It never fetches — the parent owns the data source.
 *
 * ── Async-state rule (every list screen using DataTable MUST follow this) ──────
 *  - Initial request (first load, no data yet): isLoading → skeleton rows.
 *  - Page / filter / search / page-size change: isLoading is false, isFetching is
 *    true, and RTK Query keeps the previous `data` on the hook instance — so the
 *    previous rows stay, the table dims, and a role="status" "Updating…" pill
 *    shows. NEVER a skeleton for these.
 *  - Refetch fails with rows on screen: keep the stale rows (surface the error
 *    via the app's toast). Fails with no rows: DataTableError + Retry (onRetry).
 *  - Success with zero rows: DataTableEmpty.
 *  Bind `rows` to RTK Query's `data` (persists across arg changes), NOT
 *  `currentData` (blanks on every arg change). Pass `isLoading` and `isFetching`
 *  separately and unmodified — do not gate the table on `isFetching` alone.
 */
export const DataTable = <TRow,>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  isFetching = false,
  isError = false,
  error,
  onRetry,
  sort,
  onSortChange,
  pagination,
  onPaginationChange,
  pageSizeOptions,
  search,
  filters,
  toolbar,
  onRowClick,
  rowSelection,
  renderLoading,
  renderEmpty,
  renderError,
  emptyMessage,
  minWidth,
  stickyHeader = true,
  caption,
  className,
}: DataTableProps<TRow>) => {
  const visibleColumns = useMemo(() => getVisibleColumns(columns), [columns]);
  const selectionEnabled = Boolean(rowSelection);
  const colSpan = getBodyColSpan(visibleColumns.length, selectionEnabled);

  // Per the async-state rule above: a failed *refetch* keeps stale rows visible;
  // the error state only takes over when there is nothing else to show.
  const state: DataTableState = isLoading
    ? "loading"
    : isError && rows.length === 0
      ? "error"
      : rows.length === 0
        ? "empty"
        : "data";

  const selectedIds = new Set(rowSelection?.selectedIds ?? []);
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(getRowId(row)));
  const someSelected = rows.some((row) => selectedIds.has(getRowId(row)));

  function handleToggleAll() {
    if (!rowSelection) return;
    const pageIds = rows.map(getRowId);
    if (allSelected) {
      const remaining = [...selectedIds].filter((id) => !pageIds.includes(id));
      rowSelection.onChange(remaining);
    } else {
      rowSelection.onChange([...new Set([...selectedIds, ...pageIds])]);
    }
  }

  const showFetchingOverlay = isFetching && !isLoading;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white",
        className,
      )}
    >
      <DataTableToolbar search={search} filters={filters}>
        {toolbar}
      </DataTableToolbar>

      <div className="relative min-h-0 flex-1 overflow-auto">
        <table
          aria-busy={showFetchingOverlay || undefined}
          style={{ minWidth: resolveColumnWidth(minWidth) }}
          className={cn(
            "w-full border-separate border-spacing-0 text-sm",
            showFetchingOverlay && "opacity-60 transition-opacity",
          )}
        >
          {caption && <caption className="sr-only">{caption}</caption>}

          <colgroup>
            {selectionEnabled && <col style={{ width: "2.5rem" }} />}
            {visibleColumns.map((column) => (
              <col key={column.id} style={{ width: resolveColumnWidth(column.width) }} />
            ))}
          </colgroup>

          <DataTableHeader
            columns={visibleColumns}
            sort={sort}
            onSortChange={onSortChange}
            stickyHeader={stickyHeader}
            selectionEnabled={selectionEnabled}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleAll={handleToggleAll}
          />

          <DataTableBody
            columns={visibleColumns}
            rows={rows}
            getRowId={getRowId}
            state={state}
            colSpan={colSpan}
            onRowClick={onRowClick}
            rowSelection={rowSelection}
            emptyMessage={emptyMessage}
            error={error}
            onRetry={onRetry}
            renderLoading={renderLoading}
            renderEmpty={renderEmpty}
            renderError={renderError}
          />
        </table>

        {showFetchingOverlay && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute right-3 top-2 flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-xs text-neutral-500 shadow-sm ring-1 ring-neutral-200"
          >
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
            Updating…
          </div>
        )}
      </div>

      <DataTableFooter
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        pageSizeOptions={pageSizeOptions}
        selectedCount={selectedIds.size}
      />
    </div>
  );
};
