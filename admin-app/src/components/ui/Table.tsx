import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TableProps {
  minWidthClassName?: string;
  bordered?: boolean;
  isFetching?: boolean;
  children: ReactNode;
}

export const Table = ({
  minWidthClassName,
  bordered = true,
  isFetching = false,
  children,
}: TableProps) => {
  return (
    <div
      className={cn(
        "relative",
        bordered ? "overflow-x-auto rounded-lg border border-neutral-200" : "overflow-x-auto",
      )}
    >
      <table
        aria-busy={isFetching}
        className={cn(
          "w-full border-collapse text-sm",
          isFetching && "opacity-50 transition-opacity",
          minWidthClassName,
        )}
      >
        {children}
      </table>
      {isFetching && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-xs text-neutral-500 shadow-sm ring-1 ring-neutral-200"
        >
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Updating…
        </div>
      )}
    </div>
  );
};

export interface TableHeadRowProps {
  variant?: "plain" | "shaded";
  children: ReactNode;
}

export const TableHeadRow = ({ variant = "plain", children }: TableHeadRowProps) => {
  if (variant === "shaded") {
    return (
      <thead className="bg-neutral-50 text-left">
        <tr className="border-b border-neutral-200">{children}</tr>
      </thead>
    );
  }

  return (
    <thead>
      <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase text-neutral-500">
        {children}
      </tr>
    </thead>
  );
};

export interface EmptyRowProps {
  colSpan: number;
  message: string;
}

export const EmptyRow = ({ colSpan, message }: EmptyRowProps) => {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-4 text-center text-neutral-500">
        {message}
      </td>
    </tr>
  );
};
