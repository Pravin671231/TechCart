import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DataTableEmpty } from "./DataTableEmpty";
import { DataTableError } from "./DataTableError";
import { DataTableLoading } from "./DataTableLoading";
import { getAlignClass } from "./utils";
import type { DataTableColumn, DataTableState, RowSelectionState } from "./types";

interface DataTableBodyProps<TRow> {
  /** Already filtered to visible columns. */
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getRowId: (row: TRow) => string;
  state: DataTableState;
  colSpan: number;

  onRowClick?: (row: TRow) => void;
  rowSelection?: RowSelectionState;

  emptyMessage?: ReactNode;
  error?: unknown;
  onRetry?: () => void;
  renderLoading?: () => ReactNode;
  renderEmpty?: () => ReactNode;
  renderError?: (error: unknown, retry?: () => void) => ReactNode;
}

// A clean interactive element (link/button/input) inside a cell should handle
// its own click without also triggering the row's onRowClick.
function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("a, button, input, select, label"));
}

export const DataTableBody = <TRow,>({
  columns,
  rows,
  getRowId,
  state,
  colSpan,
  onRowClick,
  rowSelection,
  emptyMessage,
  error,
  onRetry,
  renderLoading,
  renderEmpty,
  renderError,
}: DataTableBodyProps<TRow>) => {
  const selectionEnabled = Boolean(rowSelection);
  const selectedIds = new Set(rowSelection?.selectedIds ?? []);

  function toggleRow(id: string) {
    if (!rowSelection) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    rowSelection.onChange([...next]);
  }

  if (state === "loading") {
    return (
      <tbody>
        {renderLoading ? (
          <tr>
            <td colSpan={colSpan}>{renderLoading()}</td>
          </tr>
        ) : (
          <DataTableLoading columns={columns} hasSelectionColumn={selectionEnabled} />
        )}
      </tbody>
    );
  }

  if (state === "error") {
    return (
      <tbody>
        <tr>
          <td colSpan={colSpan} className="border-b border-neutral-100">
            {renderError ? renderError(error, onRetry) : (
              <DataTableError error={error} onRetry={onRetry} />
            )}
          </td>
        </tr>
      </tbody>
    );
  }

  if (state === "empty") {
    return (
      <tbody>
        <tr>
          <td colSpan={colSpan} className="border-b border-neutral-100">
            {renderEmpty ? renderEmpty() : <DataTableEmpty message={emptyMessage} />}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {rows.map((row) => {
        const id = getRowId(row);
        const selected = selectedIds.has(id);

        return (
          <tr
            key={id}
            aria-selected={selectionEnabled ? selected : undefined}
            onClick={
              onRowClick
                ? (event) => {
                    if (!isInteractiveTarget(event.target)) onRowClick(row);
                  }
                : undefined
            }
            className={cn(
              selected && "bg-primary-50",
              onRowClick && "cursor-pointer hover:bg-neutral-50",
            )}
          >
            {selectionEnabled && (
              <td className="border-b border-neutral-100 px-3 py-2">
                <span className="sr-only">Select row</span>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleRow(id)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
              </td>
            )}

            {columns.map((column) => {
              const content = column.cell(row);
              const cellClassName =
                typeof column.cellClassName === "function"
                  ? column.cellClassName(row)
                  : column.cellClassName;

              return (
                <td
                  key={column.id}
                  className={cn(
                    "border-b-2 border-neutral-300 px-3 py-2 text-sm text-neutral-700",
                    getAlignClass(column.align),
                    cellClassName,
                  )}
                >
                  {column.truncate ? (
                    <span className="block max-w-full truncate">{content}</span>
                  ) : (
                    content
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
};
