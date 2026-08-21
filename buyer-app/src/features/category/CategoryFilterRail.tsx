"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { PriceRangeInput } from "@/components/ui/PriceRangeInput";
import type { CategoryProductFilters } from "@/features/products/types";
import type { PublicBrand } from "@/features/brands/types";

export function CategoryFilterRail({
  brands,
  filters,
  onChange,
}: {
  brands: PublicBrand[];
  filters: CategoryProductFilters;
  onChange: (next: CategoryProductFilters) => void;
}) {
  function toggleBrand(brandId: string) {
    const current = filters.brand ?? [];
    const next = current.includes(brandId)
      ? current.filter((id) => id !== brandId)
      : [...current, brandId];
    onChange({ ...filters, brand: next.length > 0 ? next : undefined });
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-5 lg:flex">
      <section className="rounded-lg border border-neutral-200 p-3">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
          Price
        </h2>
        <PriceRangeInput
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onCommit={(minPrice, maxPrice) => onChange({ ...filters, minPrice, maxPrice })}
        />
      </section>

      {brands.length > 0 && (
        <section className="rounded-lg border border-neutral-200 p-3">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
            Brand
          </h2>
          <ul className="space-y-1.5 text-sm text-neutral-600">
            {brands.map((brand) => (
              <li key={brand._id}>
                <Checkbox
                  label={brand.name}
                  checked={filters.brand?.includes(brand._id) ?? false}
                  onChange={() => toggleBrand(brand._id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 p-3">
        <Checkbox
          label="In stock"
          checked={filters.inStock ?? false}
          onChange={(inStock) => onChange({ ...filters, inStock })}
        />
        <div className="mt-2">
          <Checkbox
            label="On sale"
            checked={filters.onSale ?? false}
            onChange={(onSale) => onChange({ ...filters, onSale })}
          />
        </div>
      </section>
    </aside>
  );
}
