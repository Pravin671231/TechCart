import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TableProps {
  minWidthClassName?: string;
  bordered?: boolean;
  children: ReactNode;
}

export const Table = ({ minWidthClassName, bordered = true, children }: TableProps) => {
  return (
    <div
      className={cn(
        bordered ? "overflow-x-auto rounded-lg border border-neutral-200" : "overflow-x-auto",
      )}
    >
      <table className={cn("w-full border-collapse text-sm", minWidthClassName)}>{children}</table>
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
