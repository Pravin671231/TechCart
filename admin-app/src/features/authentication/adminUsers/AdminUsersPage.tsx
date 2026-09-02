import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminUserForm } from "./AdminUserForm";
import { AdminUserList } from "./AdminUserList";

export const AdminUsersPage = () => {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <main className="flex h-full min-h-0 flex-col p-6">
      <PageHeader
        title="Admin Users"
        actions={<Button onClick={() => setIsCreating(true)}>+ New admin</Button>}
      />

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
        <AdminUserList />
        {isCreating && (
          <div className="w-full shrink-0 overflow-y-auto xl:w-96">
            <AdminUserForm
              onSaved={() => setIsCreating(false)}
              onCancel={() => setIsCreating(false)}
            />
          </div>
        )}
      </div>
    </main>
  );
};
