import type { ReactNode } from "react";
import { SearchInput } from "@/components/form/SearchInput";
import type { Breadcrumb } from "./PageHeader";
import { PageHeader } from "./PageHeader";

export interface TableLayoutSearchProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}

export interface TableLayoutProps {
  title: ReactNode;
  breadcrumbs?: Breadcrumb[];
  primaryAction?: ReactNode;
  search?: TableLayoutSearchProps;
  filters?: ReactNode;
  children: ReactNode;
  pagination?: ReactNode;
}

export const TableLayout = ({
  title,
  breadcrumbs,
  primaryAction,
  search,
  filters,
  children,
  pagination,
}: TableLayoutProps) => {
  return (
    <main className="p-6">
      <PageHeader title={title} breadcrumbs={breadcrumbs} actions={primaryAction} />

      {(search || filters) && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {search && (
            <SearchInput
              id="table-layout-search"
              label={search.label}
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder}
            />
          )}
          {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
        </div>
      )}

      {children}

      {pagination}
    </main>
  );
};
