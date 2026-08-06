import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-500";

function FieldShell({
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
}) {
  return (
    <div className={containerClassName}>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export function TextField({
  id,
  label,
  hint,
  error,
  containerClassName,
  className,
  ...rest
}: TextFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      containerClassName={containerClassName}
    >
      <input id={id} className={[INPUT_CLASS, className].filter(Boolean).join(" ")} {...rest} />
    </FieldShell>
  );
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
  height?: string;
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  containerClassName,
  height = "h-20",
  className,
  ...rest
}: TextAreaFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      containerClassName={containerClassName}
    >
      <textarea
        id={id}
        className={[INPUT_CLASS, height, className].filter(Boolean).join(" ")}
        {...rest}
      />
    </FieldShell>
  );
}

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

export function SelectField({
  id,
  label,
  hint,
  error,
  containerClassName,
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      containerClassName={containerClassName}
    >
      <select id={id} className={`${INPUT_CLASS} bg-white`} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

export interface ReadOnlyFieldProps {
  id?: string;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  mono?: boolean;
  bordered?: boolean;
  size?: "xs" | "sm";
}

export function ReadOnlyField({
  id,
  label,
  value,
  hint,
  mono = false,
  bordered = false,
  size = "xs",
}: ReadOnlyFieldProps) {
  return (
    <div>
      <span id={id} className="block text-sm font-medium text-neutral-700">
        {label}
      </span>
      <span
        className={`mt-1 block rounded-md bg-neutral-50 px-3 py-2 text-neutral-500 ${size === "xs" ? "text-xs" : "text-sm"} ${mono ? "font-mono" : ""} ${bordered ? "border border-neutral-200" : ""}`}
      >
        {value}
      </span>
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}
