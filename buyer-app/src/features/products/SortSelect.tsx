import type { ProductSort } from "./types";

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export function SortSelect({
  value,
  onChange,
}: {
  value: ProductSort;
  onChange: (value: ProductSort) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="product-sort" className="text-neutral-500">
        Sort
      </label>
      <select
        id="product-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as ProductSort)}
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
