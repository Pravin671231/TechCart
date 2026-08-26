import { Table, TableHeadRow, EmptyRow } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/ui/LoadingState";
import { SearchInput } from "@/components/form/SearchInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { ADMIN_ROLES } from "@/features/authentication/auth/adminRoles";
import { useGetAdminUsersQuery, useUpdateAdminUserMutation } from "./adminUsersApi";
import type { AdminUser } from "./types";

export interface AdminUserListProps {
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

function formatLastSignIn(value?: string): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export const AdminUserList = ({
  search,
  onSearchChange,
  page,
  onPageChange,
}: AdminUserListProps) => {
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isFetching } = useGetAdminUsersQuery({
    search: debouncedSearch || undefined,
    page,
  });
  const { data: session } = useGetSessionQuery();
  const adminUsers = data?.items ?? [];
  const pagination = data?.pagination;
  const [updateAdminUser] = useUpdateAdminUserMutation();

  async function handleRoleChange(adminUser: AdminUser, role: AdminUser["role"]) {
    await updateAdminUser({ id: adminUser._id, patch: { role } }).unwrap();
  }

  async function handleToggleStatus(adminUser: AdminUser) {
    await updateAdminUser({ id: adminUser._id, patch: { status: !adminUser.status } }).unwrap();
  }

  return (
    <section className="min-w-0 flex-1">
      <SearchInput
        id="admin-user-search"
        label="Search admin users"
        placeholder="Search by name or email…"
        value={search}
        onChange={onSearchChange}
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="mt-4">
          <Table minWidthClassName="min-w-[720px]" isFetching={isFetching}>
            <TableHeadRow>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last sign-in</th>
            </TableHeadRow>
            <tbody>
              {adminUsers.map((adminUser) => {
                const isOwnRow = session?.id === adminUser._id;
                return (
                  <tr key={adminUser._id} className="border-b border-neutral-100">
                    <td className="px-3 py-2 font-medium text-neutral-900">{adminUser.name}</td>
                    <td className="px-3 py-2">{adminUser.email}</td>
                    <td className="px-3 py-2">
                      {isOwnRow ? (
                        adminUser.role
                      ) : (
                        <label>
                          <span className="sr-only">Role for {adminUser.name}</span>
                          <select
                            value={adminUser.role}
                            onChange={(event) =>
                              void handleRoleChange(
                                adminUser,
                                event.target.value as AdminUser["role"],
                              )
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
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isOwnRow ? (
                        adminUser.status ? (
                          "Active"
                        ) : (
                          "Inactive"
                        )
                      ) : (
                        <StatusBadge
                          tone={adminUser.status ? "success" : "neutral"}
                          shape="pill"
                          onClick={() => void handleToggleStatus(adminUser)}
                        >
                          {adminUser.status ? "Active" : "Inactive"}
                        </StatusBadge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {formatLastSignIn(adminUser.lastSignInAt)}
                    </td>
                  </tr>
                );
              })}
              {adminUsers.length === 0 && <EmptyRow colSpan={5} message="No admin users found." />}
            </tbody>
          </Table>
        </div>
      )}

      {pagination && <Pagination page={page} pagination={pagination} onPageChange={onPageChange} />}
    </section>
  );
};
