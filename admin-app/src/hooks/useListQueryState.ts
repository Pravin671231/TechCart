import { useCallback, useState } from "react";

export function useListQueryState<TFilters extends object>(
  initialFilters: TFilters,
  initialLimit = 20,
) {
  const [filters, setFilters] = useState<TFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(initialLimit);

  const setFilter = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const setLimit = useCallback((next: number) => {
    setLimitState(next);
    setPage(1);
  }, []);

  return { filters, setFilter, page, setPage, limit, setLimit };
}
