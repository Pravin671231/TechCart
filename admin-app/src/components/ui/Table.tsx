import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TableProps {
  minWidthClassName?: string;
  bordered?: boolean;
  isFetching?: boolean;
  fillHeight?: boolean;
  children: ReactNode;
}

export const Table = ({
  minWidthClassName,
  bordered = true,
  isFetching = false,
  fillHeight = false,
  children,
}: TableProps) => {
  return (
    <div
      className={cn(
        "relative",
        bordered && "rounded-lg border border-neutral-200",
        fillHeight && "flex h-full min-h-0 flex-col",
      )}
    >
      <div className={cn("overflow-x-auto", fillHeight && "min-h-0 flex-1 overflow-y-auto")}>
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
      </div>
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
  sticky?: boolean;
  children: ReactNode;
}

export const TableHeadRow = ({ variant = "plain", sticky = false, children }: TableHeadRowProps) => {
  if (variant === "shaded") {
    return (
      <thead className={cn("bg-neutral-50 text-left", sticky && "sticky top-0 z-10")}>
        <tr className="border-b border-neutral-200">{children}</tr>
      </thead>
    );
  }

  return (
    <thead className={cn(sticky && "sticky top-0 z-10 bg-white")}>
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
