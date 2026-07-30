import { LuSearch } from "react-icons/lu";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <label className="flex h-9 w-64 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-500">
      <LuSearch className="h-4 w-4 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-neutral-700 outline-none placeholder:text-neutral-400"
      />
    </label>
  );
}
