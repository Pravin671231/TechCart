import type { ReactNode } from "react";

/**
 * Public type contract for the reusable DataTable.
 *
 * The component is purely presentational — it never fetches. A parent page owns
 * the data source (RTK Query, etc.) and passes `rows` + `columns` + config down.
 *
 * Deliberately NOT in v1 (the shapes below are designed to absorb these
 * additively, without a breaking API change):
 *   - row expansion / sub-rows
 *   - a column-visibility menu UI (the `hidden` flag is already honored)
 *   - multi-column sort (v1 sort is single-column)
 *   - sticky-column pixel-offset math (v1 only left-pins the selection column)
 */

export type SortDirection = "asc" | "desc";

export interface SortState {
  /** The `id` of the sorted column. Send this to the server as the sort key. */
  columnId: string;
  direction: SortDirection;
}

export interface DataTableColumn<TRow> {
  /** Stable, unique column id. Also used as the server-side sort key. */
  id: string;
  header: ReactNode;
  /** Renders the cell body. Return a link, badge, formatted value — anything. */
  cell: (row: TRow) => ReactNode;
  align?: "left" | "center" | "right";
  /** Fixed column width (e.g. `"12rem"` or `160`). Applied via `<colgroup>`. */
  width?: string | number;
  /** Show the sort control in this column's header. */
  sortable?: boolean;
  /** Wrap the cell body in a single-line truncating span. */
  truncate?: boolean;
  /** Skip rendering this column entirely. */
  hidden?: boolean;
  /** Pin the column during horizontal scroll. v1 implements the left edge only. */
  sticky?: "left" | "right";
  headerClassName?: string;
  cellClassName?: string | ((row: TRow) => string);
}

export interface DataTablePaginationState {
  /** 1-based page number. */
  page: number;
  pageSize: number;
  /** Total row count on the server (not the current page length). */
  total: number;
}

export interface DataTableSearchConfig {
  /** Called with the debounced value. */
  onSearch: (value: string) => void;
  /** Screen-reader label for the input. Default `"Search"`. */
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Debounce delay in ms. Default `300`. */
  delayMs?: number;
}

/**
 * A single declarative filter control. v1 supports `select` only; the union is
 * open so `daterange` / `multiselect` etc. slot in without a breaking change.
 */
export interface SelectFilterField {
  type: "select";
  /** Key into the filters `values` record; also the arg passed to `onChange`. */
  key: string;
  /** Screen-reader label for the control. */
  label: string;
  options: { label: string; value: string }[];
  /** The leading empty ("All") option label. Default `"All"`. */
  placeholder?: string;
}

export type FilterField = SelectFilterField;

export interface DataTableFiltersConfig {
  fields: FilterField[];
  /** Current value per field key (`""` = cleared). */
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Label for the auto reset control. Default `"Clear filters"`. */
  clearLabel?: string;
}

export interface RowSelectionState {
  selectedIds: readonly string[];
  onChange: (selectedIds: string[]) => void;
}

/** Which body content DataTable is currently showing. */
export type DataTableState = "loading" | "error" | "empty" | "data";

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  /** Stable row identity — required for React keys, selection and (later) expansion. */
  getRowId: (row: TRow) => string;

  /** First load — the body is replaced by a skeleton. */
  isLoading?: boolean;
  /** Background refetch — rows stay visible, the table dims slightly. */
  isFetching?: boolean;
  isError?: boolean;
  /** Passed through to `renderError` untouched; the default renderer ignores it. */
  error?: unknown;
  onRetry?: () => void;

  /** Current sort (server-side). `null` = unsorted. */
  sort?: SortState | null;
  onSortChange?: (next: SortState | null) => void;

  /** Current pagination (server-side). Omit to hide the footer pagination. */
  pagination?: DataTablePaginationState;
  onPaginationChange?: (next: { page: number; pageSize: number }) => void;
  pageSizeOptions?: number[];

  /** Debounced search box in the toolbar. Rendered only when provided. */
  search?: DataTableSearchConfig;
  /** Declarative filter controls in the toolbar. Rendered only when provided. */
  filters?: DataTableFiltersConfig;
  /** Extra toolbar content (bulk actions, a column-visibility menu…). */
  toolbar?: ReactNode;

  onRowClick?: (row: TRow) => void;
  /** Presence enables the leading checkbox column. */
  rowSelection?: RowSelectionState;

  renderLoading?: () => ReactNode;
  renderEmpty?: () => ReactNode;
  renderError?: (error: unknown, retry?: () => void) => ReactNode;
  emptyMessage?: ReactNode;

  /** Min table width before the body scrolls horizontally (e.g. `"60rem"`). */
  minWidth?: string | number;
  /** Pin the header while the body scrolls. Default `true`. */
  stickyHeader?: boolean;
  /** Screen-reader-only `<caption>`. */
  caption?: string;
  className?: string;
}
