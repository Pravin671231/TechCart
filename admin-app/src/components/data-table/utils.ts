import type { DataTableColumn, DataTablePaginationState, SortState } from "./types";

/** Columns that should actually render (drops `hidden`). */
export function getVisibleColumns<TRow>(
  columns: DataTableColumn<TRow>[],
): DataTableColumn<TRow>[] {
  return columns.filter((column) => !column.hidden);
}

/**
 * Tri-state sort cycle for a header click:
 *   unsorted → asc → desc → unsorted
 * Clicking a different column always starts it at `asc`.
 */
export function nextSortState(
  current: SortState | null | undefined,
  columnId: string,
): SortState | null {
  if (!current || current.columnId !== columnId) {
    return { columnId, direction: "asc" };
  }
  if (current.direction === "asc") return { columnId, direction: "desc" };
  return null;
}

/** Normalizes a column `width` (number → px) for a `<col style>` value. */
export function resolveColumnWidth(width: string | number | undefined): string | undefined {
  if (width === undefined) return undefined;
  return typeof width === "number" ? `${width}px` : width;
}

/** Column count for a full-width state row (`<td colSpan>`). */
export function getBodyColSpan(visibleColumnCount: number, hasSelectionColumn: boolean): number {
  return visibleColumnCount + (hasSelectionColumn ? 1 : 0);
}

/** `"1–20 of 137"` style range label for the footer. */
export function getRangeLabel(pagination: DataTablePaginationState): string {
  const { page, pageSize, total } = pagination;
  if (total === 0) return "0 of 0";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}–${end} of ${total}`;
}

/** Total number of pages for a given total/pageSize (never less than 1). */
export function getPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/**
 * Windowed page list for the numeric pager: first page, last page, the current
 * page ±1, and `"ellipsis"` markers for the gaps.
 */
export function getPageWindow(current: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 1) return [1];

  const pages = new Set<number>([1, pageCount, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);

  const result: Array<number | "ellipsis"> = [];
  let previous = 0;
  for (const page of sorted) {
    if (page - previous > 1) result.push("ellipsis");
    result.push(page);
    previous = page;
  }
  return result;
}

const ALIGN_CLASS: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Tailwind text-alignment class for a column's `align` (defaults to left). */
export function getAlignClass(align: DataTableColumn<unknown>["align"]): string {
  return ALIGN_CLASS[align ?? "left"];
}
