import { useMemo } from "react";
import { useNavigate } from "react-router";
import { DataTable, type DataTableColumn, type SortState } from "@/components/data-table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useListQueryState } from "@/hooks/useListQueryState";
import { useGetUserDirectoryQuery } from "./userDirectoryApi";
import { USER_DIRECTORY_ROUTES } from "./routePaths";
import type { UserDirectoryEntry, UserDirectoryRole } from "./types";

type UserDirectorySortField = "name" | "email" | "createdAt" | "lastSignInAt";

interface UserDirectoryFilters {
  search: string;
  role: UserDirectoryRole | "";
  status: "" | "true" | "false";
  sortBy?: UserDirectorySortField;
  orderBy?: "asc" | "desc";
}

const ROLE_OPTIONS: { label: string; value: UserDirectoryRole }[] = [
  { label: "Buyer", value: "buyer" },
  { label: "Catalog manager", value: "catalog-manager" },
  { label: "Order manager", value: "order-manager" },
  { label: "Super admin", value: "super-admin" },
];

const STATUS_OPTIONS = [
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

function formatLastSignIn(value?: string): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

// Sort keys DataTable speaks (columnId/direction) map 1:1 onto the backend's
// own sortBy/orderBy params here — no combined-string adapter needed, unlike
// OrderList.tsx's OrderSort.
function toSortState(
  sortBy: UserDirectorySortField | undefined,
  orderBy: "asc" | "desc" | undefined,
): SortState | null {
  if (!sortBy || !orderBy) return null;
  return { columnId: sortBy, direction: orderBy };
}

export const UserDirectoryList = () => {
  const navigate = useNavigate();
  const { filters, setFilter, page, setPage, limit, setLimit } =
    useListQueryState<UserDirectoryFilters>({
      search: "",
      role: "",
      status: "",
      sortBy: undefined,
      orderBy: undefined,
    });

  const { data, isLoading, isFetching, isError, refetch } = useGetUserDirectoryQuery({
    search: filters.search || undefined,
    role: filters.role || undefined,
    status: filters.status === "" ? undefined : filters.status === "true",
    page,
    limit,
    sortBy: filters.sortBy,
    orderBy: filters.orderBy,
  });

  const columns = useMemo<DataTableColumn<UserDirectoryEntry>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        cell: (entry) => (
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{entry.name}</span>
        ),
      },
      {
        id: "email",
        header: "Email",
        sortable: true,
        cell: (entry) => entry.email,
      },
      {
        id: "role",
        header: "Role",
        cell: (entry) => entry.role,
      },
      {
        id: "status",
        header: "Status",
        cell: (entry) => (
          <StatusBadge tone={entry.status ? "success" : "neutral"} shape="pill">
            {entry.status ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
      {
        id: "isVerified",
        header: "Verified",
        cell: (entry) => (
          <StatusBadge tone={entry.isVerified ? "success" : "warning"} shape="pill">
            {entry.isVerified ? "Verified" : "Unverified"}
          </StatusBadge>
        ),
      },
      {
        id: "lastSignInAt",
        header: "Last sign-in",
        sortable: true,
        cell: (entry) => (
          <span className="text-neutral-500 dark:text-neutral-400">
            {formatLastSignIn(entry.lastSignInAt)}
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        sortable: true,
        cell: (entry) => (
          <span className="text-neutral-500 dark:text-neutral-400">
            {formatDate(entry.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const entries = data?.items ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <DataTable<UserDirectoryEntry>
      className="min-h-0 flex-1"
      columns={columns}
      rows={entries}
      getRowId={(entry) => entry._id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      onRetry={refetch}
      emptyMessage="No users found."
      caption="User directory"
      minWidth="56rem"
      onRowClick={(entry) => navigate(USER_DIRECTORY_ROUTES.detail(entry._id))}
      search={{
        label: "Search users",
        placeholder: "Search by name or email…",
        defaultValue: filters.search,
        onSearch: (value) => setFilter("search", value),
      }}
      filters={{
        fields: [
          {
            type: "select",
            key: "role",
            label: "Role",
            placeholder: "Role: All",
            options: ROLE_OPTIONS,
          },
          {
            type: "select",
            key: "status",
            label: "Status",
            placeholder: "Status: All",
            options: STATUS_OPTIONS,
          },
        ],
        values: { role: filters.role, status: filters.status },
        onChange: (key, value) => {
          if (key === "role") setFilter("role", value as UserDirectoryRole | "");
          else setFilter("status", value as "" | "true" | "false");
        },
      }}
      sort={toSortState(filters.sortBy, filters.orderBy)}
      onSortChange={(next) => {
        setFilter("sortBy", next ? (next.columnId as UserDirectorySortField) : undefined);
        setFilter("orderBy", next ? next.direction : undefined);
      }}
      pagination={{ page, pageSize: limit, total }}
      onPaginationChange={({ page: nextPage, pageSize }) => {
        if (pageSize !== limit) setLimit(pageSize);
        else setPage(nextPage);
      }}
    />
  );
};
