import { useEffect, useId, useRef, useState } from "react";
import type { DataTableSearchConfig } from "./types";

/**
 * Debounced search input. Owns the instant text state for a responsive field and
 * calls `onSearch` only after `delayMs` of quiet — so the consumer never needs
 * `useDebouncedValue`. `onSearch` is read through a ref so passing an inline
 * arrow doesn't restart the timer on every render; the first (mount) value is
 * not emitted.
 */
export const DataTableSearch = ({
  onSearch,
  label = "Search",
  placeholder = "Search…",
  defaultValue = "",
  delayMs = 300,
}: DataTableSearchConfig) => {
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);

  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const timer = setTimeout(() => onSearchRef.current(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return (
    <div className="flex items-center">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        className="h-9 w-64 rounded-md border border-neutral-300 px-3 text-sm placeholder:text-neutral-400 focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
      />
    </div>
  );
};
