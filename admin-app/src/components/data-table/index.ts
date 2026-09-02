/**
 * Public entry point for the reusable DataTable.
 *
 * The rest of `admin-app` imports files directly, but this folder ships a barrel
 * so a consumer pulls the table + its types from one path:
 *
 *   import { DataTable, type DataTableColumn } from "@/components/data-table";
 *
 * `DataTableHeader` / `DataTableBody` / `DataTableFooter` are intentionally not
 * exported — they only make sense inside `DataTable`'s own `<table>`.
 */

export { DataTable } from "./DataTable";
export { DataTableToolbar } from "./DataTableToolbar";
export { DataTableSearch } from "./DataTableSearch";
export { DataTableFilters } from "./DataTableFilters";
export { DataTablePagination } from "./DataTablePagination";
export { DataTableLoading } from "./DataTableLoading";
export { DataTableEmpty } from "./DataTableEmpty";
export { DataTableError } from "./DataTableError";

export type {
  DataTableColumn,
  DataTableProps,
  DataTablePaginationState,
  DataTableState,
  DataTableSearchConfig,
  DataTableFiltersConfig,
  FilterField,
  SelectFilterField,
  RowSelectionState,
  SortState,
  SortDirection,
} from "./types";
