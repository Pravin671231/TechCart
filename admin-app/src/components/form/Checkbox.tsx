import { forwardRef } from "react";

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  return (
    <label
      htmlFor={id}
      className="flex h-9 w-fit items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-600"
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={`h-4 w-4 rounded-md border-neutral-200 accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className ?? ""}`}
        {...props}
      />
      {label}
    </label>
  );
});
