import { useCallback, useState } from "react";

export function useListQueryState<TFilters extends object>(initialFilters: TFilters) {
  const [filters, setFilters] = useState<TFilters>(initialFilters);
  const [page, setPage] = useState(1);

  const setFilter = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  return { filters, setFilter, page, setPage };
}
