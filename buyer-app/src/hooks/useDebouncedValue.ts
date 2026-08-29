"use client";

import { useEffect, useState } from "react";

// Shared debounce hook — extracted from components/layout/SearchBar.tsx
// (Issue #326) once a second consumer appeared. Returns `value` unchanged
// until it has stopped changing for `delayMs`.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
