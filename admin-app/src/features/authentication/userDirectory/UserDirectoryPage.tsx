import { PageHeader } from "@/components/layout/PageHeader";
import { UserDirectoryList } from "./UserDirectoryList";

// No "+ New" action, unlike AdminUsersPage — the backend endpoint this
// consumes is read-only, there is no create capability here.
export const UserDirectoryPage = () => {
  return (
    <main className="flex h-full min-h-0 flex-col p-6">
      <PageHeader title="User Directory" />
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <UserDirectoryList />
      </div>
    </main>
  );
};
