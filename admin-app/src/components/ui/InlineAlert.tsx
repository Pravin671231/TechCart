import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASS = {
  error: "border-red-200 bg-red-50 text-red-800",
} as const;

export interface InlineAlertProps {
  variant?: keyof typeof VARIANT_CLASS;
  children: ReactNode;
  className?: string;
}

export const InlineAlert = ({ variant = "error", children, className }: InlineAlertProps) => {
  return (
    <div
      role="alert"
      className={cn("rounded-md border p-3 text-sm", VARIANT_CLASS[variant], className)}
    >
      {children}
    </div>
  );
};
