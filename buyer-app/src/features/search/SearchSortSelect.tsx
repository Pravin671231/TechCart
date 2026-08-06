import type { SearchProductSort } from "@/features/products/types";

const SORT_OPTIONS: { value: SearchProductSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export function SearchSortSelect({
  value,
  onChange,
}: {
  value: SearchProductSort;
  onChange: (value: SearchProductSort) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="search-sort" className="text-neutral-500">
        Sort
      </label>
      <select
        id="search-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as SearchProductSort)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
