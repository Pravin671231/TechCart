import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500";

const FieldShell = ({
  id,
  label,
  hint,
  error,
  containerClassName,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
  children: ReactNode;
}) => {
  return (
    <div className={containerClassName}>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export const TextField = ({
  id,
  label,
  hint,
  error,
  containerClassName,
  className,
  ...rest
}: TextFieldProps) => {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      containerClassName={containerClassName}
    >
      <input id={id} className={cn(INPUT_CLASS, className)} {...rest} />
    </FieldShell>
  );
};

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
  height?: string;
}

export const TextAreaField = ({
  id,
  label,
  hint,
  error,
  containerClassName,
  height = "h-20",
  className,
  ...rest
}: TextAreaFieldProps) => {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      containerClassName={containerClassName}
    >
      <textarea id={id} className={cn(INPUT_CLASS, height, className)} {...rest} />
    </FieldShell>
  );
};

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className"
> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
  children: ReactNode;
}

export const SelectField = ({
  id,
  label,
  hint,
  error,
  containerClassName,
  children,
  ...rest
}: SelectFieldProps) => {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      containerClassName={containerClassName}
    >
      <select id={id} className={cn(INPUT_CLASS, "bg-white dark:bg-neutral-900")} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
};

const readOnlyValueVariants = cva(
  "mt-1 block rounded-md bg-neutral-50 px-3 py-2 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  {
    variants: {
      size: {
        xs: "text-xs",
        sm: "text-sm",
      },
      mono: {
        true: "font-mono",
        false: "",
      },
      bordered: {
        true: "border border-neutral-200 dark:border-neutral-700",
        false: "",
      },
    },
    defaultVariants: {
      size: "xs",
      mono: false,
      bordered: false,
    },
  },
);

export interface ReadOnlyFieldProps {
  id?: string;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  mono?: boolean;
  bordered?: boolean;
  size?: "xs" | "sm";
}

export const ReadOnlyField = ({
  id,
  label,
  value,
  hint,
  mono = false,
  bordered = false,
  size = "xs",
}: ReadOnlyFieldProps) => {
  return (
    <div>
      <span id={id} className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {label}
      </span>
      <span className={readOnlyValueVariants({ size, mono, bordered })}>{value}</span>
      {hint && <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">{hint}</p>}
    </div>
  );
};
