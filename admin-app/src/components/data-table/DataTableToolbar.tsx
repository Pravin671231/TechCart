import type { ReactNode } from "react";
import { DataTableFilters } from "./DataTableFilters";
import { DataTableSearch } from "./DataTableSearch";
import type { DataTableFiltersConfig, DataTableSearchConfig } from "./types";

interface DataTableToolbarProps {
  search?: DataTableSearchConfig;
  filters?: DataTableFiltersConfig;
  /** Extra content (bulk actions, column-visibility menu…). */
  children?: ReactNode;
}

/**
 * The row above the table: a debounced search box, config-driven filters, and an
 * open slot — all optional. Renders nothing when none are supplied.
 */
export const DataTableToolbar = ({ search, filters, children }: DataTableToolbarProps) => {
  if (!search && !filters && !children) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-neutral-200 px-3 py-2">
      {search && <DataTableSearch {...search} />}
      {filters && <DataTableFilters {...filters} />}
      {children}
    </div>
  );
};
