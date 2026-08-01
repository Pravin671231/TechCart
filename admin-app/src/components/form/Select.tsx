import { forwardRef } from "react";
import { LuChevronDown } from "react-icons/lu";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
  placeholder?: string;
  hasError?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, hasError, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={`h-10 w-full appearance-none rounded-md border bg-white px-3 pr-8 text-sm text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:bg-neutral-50 disabled:text-neutral-400 ${
          hasError ? "border-danger-600" : "border-neutral-200"
        } ${className ?? ""}`}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <LuChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
    </div>
  );
});
