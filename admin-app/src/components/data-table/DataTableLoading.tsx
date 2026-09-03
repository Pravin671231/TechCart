import { cn } from "@/lib/utils";
import { getAlignClass } from "./utils";
import type { DataTableColumn } from "./types";

interface DataTableLoadingProps<TRow> {
  /** Visible columns — one skeleton bar is rendered per column. */
  columns: DataTableColumn<TRow>[];
  /** Number of skeleton rows. Defaults to 8. */
  rowCount?: number;
  hasSelectionColumn?: boolean;
}

// Varied widths so the skeleton reads as content rather than a solid block.
const BAR_WIDTHS = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-1/3"];

/**
 * Skeleton rows shown during the first load. Rendered directly inside `<tbody>`,
 * so it returns a fragment of `<tr>` elements (not a wrapper).
 */
export const DataTableLoading = <TRow,>({
  columns,
  rowCount = 8,
  hasSelectionColumn = false,
}: DataTableLoadingProps<TRow>) => {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true">
          {hasSelectionColumn && (
            <td className="border-b border-neutral-100 px-3 py-2">
              <span className="block h-4 w-4 animate-pulse rounded bg-neutral-200" />
            </td>
          )}
          {columns.map((column, columnIndex) => (
            <td
              key={column.id}
              className={cn("border-b border-neutral-100 px-3 py-2", getAlignClass(column.align))}
            >
              <span
                className={cn(
                  "block h-4 animate-pulse rounded bg-neutral-200",
                  BAR_WIDTHS[(rowIndex + columnIndex) % BAR_WIDTHS.length],
                  column.align === "right" && "ml-auto",
                  column.align === "center" && "mx-auto",
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};
