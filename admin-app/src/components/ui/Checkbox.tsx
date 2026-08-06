import type { InputHTMLAttributes, ReactNode } from "react";

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  visuallyHiddenLabel?: boolean;
  labelClassName?: string;
}

export function Checkbox({
  label,
  visuallyHiddenLabel = false,
  labelClassName = "gap-2 text-sm text-neutral-600",
  className,
  ...rest
}: CheckboxProps) {
  return (
    <label className={`flex items-center ${labelClassName}`}>
      <input
        type="checkbox"
        className={["h-4 w-4 rounded border-neutral-300", className].filter(Boolean).join(" ")}
        {...rest}
      />
      {visuallyHiddenLabel ? <span className="sr-only">{label}</span> : label}
    </label>
  );
}
