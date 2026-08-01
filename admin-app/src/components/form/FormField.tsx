type FormFieldProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: React.ReactNode;
};

export function FormField({ label, htmlFor, required, helperText, error, children }: FormFieldProps) {
  return (
    <div className="block text-sm">
      <label htmlFor={htmlFor} className="text-neutral-500">
        {label}
        {required ? " *" : null}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-danger-600">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-neutral-400">{helperText}</p>
      ) : null}
    </div>
  );
}
