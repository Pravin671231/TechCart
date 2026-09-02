import { cn } from "@/lib/utils";
import { getAlignClass, nextSortState } from "./utils";
import type { DataTableColumn, SortState } from "./types";

interface DataTableHeaderProps<TRow> {
  /** Already filtered to visible columns. */
  columns: DataTableColumn<TRow>[];
  sort: SortState | null | undefined;
  onSortChange?: (next: SortState | null) => void;
  stickyHeader: boolean;
  selectionEnabled: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
}

function ariaSort(
  column: { id: string; sortable?: boolean },
  sort: SortState | null | undefined,
): "ascending" | "descending" | "none" | undefined {
  if (!column.sortable) return undefined;
  if (sort?.columnId !== column.id) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

export const DataTableHeader = <TRow,>({
  columns,
  sort,
  onSortChange,
  stickyHeader,
  selectionEnabled,
  allSelected,
  someSelected,
  onToggleAll,
}: DataTableHeaderProps<TRow>) => {
  const thBase = cn(
    "border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500",
    stickyHeader && "sticky top-0 z-10",
  );

  return (
    <thead>
      <tr>
        {selectionEnabled && (
          <th
            scope="col"
            className={cn(thBase, "w-10", stickyHeader && "left-0 z-20")}
          >
            <span className="sr-only">Select all rows</span>
            <input
              type="checkbox"
              checked={allSelected}
              ref={(node) => {
                if (node) node.indeterminate = someSelected && !allSelected;
              }}
              onChange={onToggleAll}
              className="h-4 w-4 rounded border-neutral-300"
            />
          </th>
        )}

        {columns.map((column) => {
          const isSorted = column.sortable && sort?.columnId === column.id;
          const glyph = !isSorted ? "⇅" : sort?.direction === "asc" ? "↑" : "↓";

          return (
            <th
              key={column.id}
              scope="col"
              aria-sort={ariaSort(column, sort)}
              className={cn(thBase, getAlignClass(column.align), column.headerClassName)}
            >
              {column.sortable && onSortChange ? (
                <button
                  type="button"
                  onClick={() => onSortChange(nextSortState(sort, column.id))}
                  className={cn(
                    "inline-flex items-center gap-1 hover:text-neutral-700",
                    isSorted && "text-neutral-900",
                  )}
                >
                  {column.header}
                  <span aria-hidden="true">{glyph}</span>
                </button>
              ) : (
                column.header
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
};
