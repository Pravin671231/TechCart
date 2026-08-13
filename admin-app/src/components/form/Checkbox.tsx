import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  visuallyHiddenLabel?: boolean;
  labelClassName?: string;
}

export const Checkbox = ({
  label,
  visuallyHiddenLabel = false,
  labelClassName = "gap-2 text-sm text-neutral-600",
  className,
  ...rest
}: CheckboxProps) => {
  return (
    <label className={cn("flex items-center", labelClassName)}>
      <input
        type="checkbox"
        className={cn("h-4 w-4 rounded border-neutral-300", className)}
        {...rest}
      />
      {visuallyHiddenLabel ? <span className="sr-only">{label}</span> : label}
    </label>
  );
};
