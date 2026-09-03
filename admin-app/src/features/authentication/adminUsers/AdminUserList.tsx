import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useListQueryState } from "@/hooks/useListQueryState";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { ADMIN_ROLES } from "@/features/authentication/auth/adminRoles";
import { useGetAdminUsersQuery, useUpdateAdminUserMutation } from "./adminUsersApi";
import type { AdminUser } from "./types";

function formatLastSignIn(value?: string): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export const AdminUserList = () => {
  const { filters, setFilter, page, setPage, limit, setLimit } = useListQueryState<{
    search: string;
  }>({ search: "" });

  const { data, isLoading, isFetching, isError, refetch } = useGetAdminUsersQuery({
    search: filters.search || undefined,
    page,
    limit,
  });
  const { data: session } = useGetSessionQuery();
  const [updateAdminUser] = useUpdateAdminUserMutation();

  async function handleRoleChange(adminUser: AdminUser, role: AdminUser["role"]) {
    await updateAdminUser({ id: adminUser._id, patch: { role } }).unwrap();
  }

  async function handleToggleStatus(adminUser: AdminUser) {
    await updateAdminUser({ id: adminUser._id, patch: { status: !adminUser.status } }).unwrap();
  }

  const columns: DataTableColumn<AdminUser>[] = [
    {
      id: "name",
      header: "Name",
      cell: (adminUser) => <span className="font-medium text-neutral-900">{adminUser.name}</span>,
    },
    {
      id: "email",
      header: "Email",
      cell: (adminUser) => adminUser.email,
    },
    {
      id: "role",
      header: "Role",
      cell: (adminUser) => {
        if (session?.id === adminUser._id) return adminUser.role;
        return (
          <label>
            <span className="sr-only">Role for {adminUser.name}</span>
            <select
              value={adminUser.role}
              onChange={(event) =>
                void handleRoleChange(adminUser, event.target.value as AdminUser["role"])
              }
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
            >
              {ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (adminUser) => {
        if (session?.id === adminUser._id) return adminUser.status ? "Active" : "Inactive";
        return (
          <StatusBadge
            tone={adminUser.status ? "success" : "neutral"}
            shape="pill"
            onClick={() => void handleToggleStatus(adminUser)}
          >
            {adminUser.status ? "Active" : "Inactive"}
          </StatusBadge>
        );
      },
    },
    {
      id: "lastSignInAt",
      header: "Last sign-in",
      cell: (adminUser) => (
        <span className="text-neutral-500">{formatLastSignIn(adminUser.lastSignInAt)}</span>
      ),
    },
  ];

  const adminUsers = data?.items ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <DataTable<AdminUser>
      className="min-h-0 flex-1"
      columns={columns}
      rows={adminUsers}
      getRowId={(adminUser) => adminUser._id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      onRetry={refetch}
      emptyMessage="No admin users found."
      caption="Admin user list"
      minWidth="44rem"
      search={{
        label: "Search admin users",
        placeholder: "Search by name or email…",
        defaultValue: filters.search,
        onSearch: (value) => setFilter("search", value),
      }}
      pagination={{ page, pageSize: limit, total }}
      onPaginationChange={({ page: nextPage, pageSize }) => {
        if (pageSize !== limit) setLimit(pageSize);
        else setPage(nextPage);
      }}
    />
  );
};
