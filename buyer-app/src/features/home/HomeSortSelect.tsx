import type { HomeProductSort } from "@/features/products/types";

// Home-only sort control. "Recommended" (the default) maps to the backend's
// `sort=recommended` — an interleaved-by-category ordering (FR-CAT-105) that
// only the flat listing supports, so it lives here rather than in the shared
// `products/SortSelect` the category page uses.
const SORT_OPTIONS: { value: HomeProductSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export function HomeSortSelect({
  value,
  onChange,
}: {
  value: HomeProductSort;
  onChange: (value: HomeProductSort) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="home-sort" className="text-neutral-500">
        Sort
      </label>
      <select
        id="home-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as HomeProductSort)}
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
