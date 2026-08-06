import { useState } from "react";
import type { SearchProductFilters } from "@/features/products/types";
import type { PublicBrand } from "@/features/brands/types";
import type { PublicCategory } from "@/features/categories/types";

export function SearchFilterRail({
  categories,
  brands,
  filters,
  onChange,
}: {
  categories: PublicCategory[];
  brands: PublicBrand[];
  filters: SearchProductFilters;
  onChange: (next: SearchProductFilters) => void;
}) {
  const [minPriceInput, setMinPriceInput] = useState(filters.minPrice?.toString() ?? "");
  const [maxPriceInput, setMaxPriceInput] = useState(filters.maxPrice?.toString() ?? "");

  const topLevelCategories = categories.filter((category) => category.parentCategory === null);

  function selectCategory(slug: string) {
    onChange({ ...filters, category: filters.category === slug ? undefined : slug });
  }

  function toggleBrand(brandId: string) {
    const current = filters.brand ?? [];
    const next = current.includes(brandId)
      ? current.filter((id) => id !== brandId)
      : [...current, brandId];
    onChange({ ...filters, brand: next.length > 0 ? next : undefined });
  }

  function commitPriceRange() {
    const minPrice = minPriceInput === "" ? undefined : Number(minPriceInput);
    const maxPrice = maxPriceInput === "" ? undefined : Number(maxPriceInput);
    onChange({ ...filters, minPrice, maxPrice });
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-5 lg:flex">
      {categories.length > 0 && (
        <section className="rounded-lg border border-neutral-200 p-3">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
            Category
          </h2>
          <ul className="space-y-1.5 text-sm text-neutral-600">
            {topLevelCategories.map((category) => (
              <li key={category._id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.category === category.slug}
                    onChange={() => selectCategory(category.slug)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  {category.name}
                </label>
                <ul className="mt-1 space-y-1.5 pl-4">
                  {categories
                    .filter((child) => child.parentCategory === category._id)
                    .map((child) => (
                      <li key={child._id}>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={filters.category === child.slug}
                            onChange={() => selectCategory(child.slug)}
                            className="h-4 w-4 rounded border-neutral-300"
                          />
                          {child.name}
                        </label>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 p-3">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
          Price
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="number"
            aria-label="Minimum price"
            placeholder="Min ₹"
            value={minPriceInput}
            onChange={(event) => setMinPriceInput(event.target.value)}
            onBlur={commitPriceRange}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitPriceRange();
            }}
            className="w-full min-w-0 rounded-md border border-neutral-300 px-2 py-1.5 text-neutral-700"
          />
          <span className="text-neutral-400">—</span>
          <input
            type="number"
            aria-label="Maximum price"
            placeholder="Max ₹"
            value={maxPriceInput}
            onChange={(event) => setMaxPriceInput(event.target.value)}
            onBlur={commitPriceRange}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitPriceRange();
            }}
            className="w-full min-w-0 rounded-md border border-neutral-300 px-2 py-1.5 text-neutral-700"
          />
        </div>
      </section>

      {brands.length > 0 && (
        <section className="rounded-lg border border-neutral-200 p-3">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
            Brand
          </h2>
          <ul className="space-y-1.5 text-sm text-neutral-600">
            {brands.map((brand) => (
              <li key={brand._id} className="flex items-center gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.brand?.includes(brand._id) ?? false}
                    onChange={() => toggleBrand(brand._id)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  {brand.name}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 p-3">
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={filters.inStock ?? false}
            onChange={(event) => onChange({ ...filters, inStock: event.target.checked })}
            className="h-4 w-4 rounded border-neutral-300"
          />
          In stock
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={filters.onSale ?? false}
            onChange={(event) => onChange({ ...filters, onSale: event.target.checked })}
            className="h-4 w-4 rounded border-neutral-300"
          />
          On sale
        </label>
      </section>
    </aside>
  );
}
