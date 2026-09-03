import type { ReactNode } from "react";

interface DataTableEmptyProps {
  message?: ReactNode;
  /** Optional call-to-action (e.g. a "Create" button). */
  action?: ReactNode;
}

/** Default empty state. Rendered inside a full-width `<td colSpan>`. */
export const DataTableEmpty = ({
  message = "No records found.",
  action,
}: DataTableEmptyProps) => {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <p className="text-sm text-neutral-500">{message}</p>
      {action}
    </div>
  );
};
