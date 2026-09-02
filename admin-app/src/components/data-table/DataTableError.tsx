import type { ReactNode } from "react";

interface DataTableErrorProps {
  message?: ReactNode;
  /**
   * The raw error, forwarded from `DataTableProps.error`. The default renderer
   * doesn't display it (it may hold sensitive detail); a consumer's
   * `renderError` override can.
   */
  error?: unknown;
  onRetry?: () => void;
}

/** Default error state. Rendered inside a full-width `<td colSpan>`. */
export const DataTableError = ({
  message = "Something went wrong.",
  onRetry,
}: DataTableErrorProps) => {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-3 px-4 py-10 text-center"
    >
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Retry
        </button>
      )}
    </div>
  );
};
