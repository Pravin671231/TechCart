import { useParams } from "react-router";
import { BreadcrumbHeading } from "@/components/ui/BreadcrumbHeading";
import { Card, CardHeading } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/LoadingState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useGetUserDirectoryEntryQuery } from "./userDirectoryApi";
import { USER_DIRECTORY_ROUTES } from "./routePaths";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// Purely read-only, per Issue #385's own scope — the backend endpoint this
// consumes has no PATCH/DELETE at all, so this view has no action buttons,
// unlike OrderDetailPage.tsx.
export const UserDirectoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: entry, isLoading, isError } = useGetUserDirectoryEntryQuery(id ?? "", {
    skip: !id,
  });

  if (isLoading) return <LoadingState fullPage />;
  if (isError || !entry) {
    return <ErrorState fullPage message="Unable to load this user." />;
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <BreadcrumbHeading
          backTo={USER_DIRECTORY_ROUTES.list}
          backLabel="User Directory"
          current={entry.name}
        />
        <div className="flex items-center gap-2">
          <StatusBadge tone={entry.status ? "success" : "neutral"} shape="pill">
            {entry.status ? "Active" : "Inactive"}
          </StatusBadge>
          <StatusBadge tone={entry.isVerified ? "success" : "warning"} shape="pill">
            {entry.isVerified ? "Verified" : "Unverified"}
          </StatusBadge>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeading>Details</CardHeading>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-neutral-500 dark:text-neutral-400">Name</dt>
            <dd className="text-neutral-900 dark:text-neutral-100">{entry.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-neutral-500 dark:text-neutral-400">Email</dt>
            <dd className="text-neutral-900 dark:text-neutral-100">{entry.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-neutral-500 dark:text-neutral-400">Role</dt>
            <dd className="text-neutral-900 dark:text-neutral-100">{entry.role}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-neutral-500 dark:text-neutral-400">Last sign-in</dt>
            <dd className="text-neutral-900 dark:text-neutral-100">
              {entry.lastSignInAt ? formatDateTime(entry.lastSignInAt) : "—"}
            </dd>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <dt className="w-28 shrink-0 text-neutral-500 dark:text-neutral-400">Created</dt>
            <dd className="text-neutral-900 dark:text-neutral-100">
              {formatDateTime(entry.createdAt)}
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
};
