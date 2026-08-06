export interface SearchInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: string;
}

export function SearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  width = "w-64",
}: SearchInputProps) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-9 ${width} rounded-md border border-neutral-300 px-3 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none`}
      />
    </>
  );
}
