import { forwardRef } from "react";

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
  mono?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { hasError, mono, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`block h-10 w-full rounded-md border px-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:bg-neutral-50 disabled:text-neutral-400 ${
        hasError ? "border-danger-600" : "border-neutral-200"
      } ${mono ? "font-mono text-xs" : ""} ${className ?? ""}`}
      {...props}
    />
  );
});
