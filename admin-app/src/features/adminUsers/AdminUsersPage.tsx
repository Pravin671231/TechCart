import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useListQueryState } from "@/hooks/useListQueryState";
import { AdminUserForm } from "./AdminUserForm";
import { AdminUserList } from "./AdminUserList";

export const AdminUsersPage = () => {
  const { filters, setFilter, page, setPage } = useListQueryState<{ search: string }>({
    search: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  return (
    <main className="p-6">
      <PageHeader
        title="Admin Users"
        actions={<Button onClick={() => setIsCreating(true)}>+ New admin</Button>}
      />

      <div className="flex flex-col gap-6 xl:flex-row">
        <AdminUserList
          search={filters.search}
          onSearchChange={(value) => setFilter("search", value)}
          page={page}
          onPageChange={setPage}
        />
        {isCreating && (
          <AdminUserForm onSaved={() => setIsCreating(false)} onCancel={() => setIsCreating(false)} />
        )}
      </div>
    </main>
  );
};
