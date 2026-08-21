import { Checkbox } from "@/components/ui/Checkbox";
import { PriceRangeInput } from "@/components/ui/PriceRangeInput";
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
                <Checkbox
                  label={category.name}
                  checked={filters.category === category.slug}
                  onChange={() => selectCategory(category.slug)}
                />
                <ul className="mt-1 space-y-1.5 pl-4">
                  {categories
                    .filter((child) => child.parentCategory === category._id)
                    .map((child) => (
                      <li key={child._id}>
                        <Checkbox
                          label={child.name}
                          checked={filters.category === child.slug}
                          onChange={() => selectCategory(child.slug)}
                        />
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
