"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { PriceRangeInput } from "@/components/ui/PriceRangeInput";
import type { CategoryProductFilters } from "@/features/products/types";
import type { CategoryFilterOptions } from "@/features/categories/types";

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 p-3">
      {title && (
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function CategoryFilterRail({
  filterOptions,
  filters,
  onChange,
}: {
  filterOptions: CategoryFilterOptions | undefined;
  filters: CategoryProductFilters;
  onChange: (next: CategoryProductFilters) => void;
}) {
  const brands = filterOptions?.brands ?? [];
  const specs = filterOptions?.specifications ?? [];
  const axes = filterOptions?.variantAxes ?? [];
  const priceRange = filterOptions?.priceRange ?? null;

  function toggleBrand(brandId: string) {
    const current = filters.brand ?? [];
    const next = current.includes(brandId)
      ? current.filter((id) => id !== brandId)
      : [...current, brandId];
    onChange({ ...filters, brand: next.length > 0 ? next : undefined });
  }

  function setSpec(name: string, value: string | { min?: number; max?: number } | undefined) {
    const nextSpec = { ...(filters.spec ?? {}) };
    if (value === undefined) {
      delete nextSpec[name];
    } else {
      nextSpec[name] = value;
    }
    onChange({ ...filters, spec: Object.keys(nextSpec).length > 0 ? nextSpec : undefined });
  }

  // One variant-attribute pair total, across every axis (FR-CAT-104).
  function setAxis(axisName: string, value: string | undefined) {
    if (value === undefined) {
      const next = { ...filters };
      delete next.attributeName;
      delete next.attributeValue;
      onChange(next);
    } else {
      onChange({ ...filters, attributeName: axisName, attributeValue: value });
    }
  }

  function specRange(name: string): { min?: number; max?: number } {
    const selection = filters.spec?.[name];
    return selection && typeof selection === "object" ? selection : {};
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <Section title="Price">
        <PriceRangeInput
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          minBound={priceRange?.min}
          maxBound={priceRange?.max}
          onCommit={(minPrice, maxPrice) => onChange({ ...filters, minPrice, maxPrice })}
        />
      </Section>

      {brands.length > 0 && (
        <Section title="Brand">
          <ul className="space-y-1.5">
            {brands.map((brand) => (
              <li key={brand._id}>
                <Checkbox
                  label={`${brand.name} (${brand.productCount})`}
                  checked={filters.brand?.includes(brand._id) ?? false}
                  onChange={() => toggleBrand(brand._id)}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {specs.map((spec) => (
        <Section key={spec.name} title={spec.unit ? `${spec.name} (${spec.unit})` : spec.name}>
          {spec.type === "number" ? (
            <PriceRangeInput
              minPrice={specRange(spec.name).min}
              maxPrice={specRange(spec.name).max}
              minBound={spec.min}
              maxBound={spec.max}
              minLabel={`Minimum ${spec.name}`}
              maxLabel={`Maximum ${spec.name}`}
              onCommit={(min, max) =>
                setSpec(
                  spec.name,
                  min === undefined && max === undefined ? undefined : { min, max },
                )
              }
            />
          ) : spec.type === "boolean" ? (
            <Checkbox
              label={spec.name}
              checked={filters.spec?.[spec.name] === "true"}
              onChange={(checked) => setSpec(spec.name, checked ? "true" : undefined)}
            />
          ) : (
            <ul className="space-y-1.5">
              {(spec.options ?? []).map((option) => {
                const active = filters.spec?.[spec.name] === option;
                return (
                  <li key={option}>
                    <Checkbox
                      label={option}
                      checked={active}
                      onChange={() => setSpec(spec.name, active ? undefined : option)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      ))}

      {axes.length > 0 && (
        <Section title="Options">
          {axes.map((axis) => (
            <div key={axis.code} className="mb-3 last:mb-0">
              <p className="mb-1 text-xs font-medium text-neutral-600">{axis.name}</p>
              <ul className="space-y-1.5">
                {axis.options.map((option) => {
                  const active =
                    filters.attributeName === axis.name && filters.attributeValue === option.value;
                  return (
                    <li key={option.value}>
                      <Checkbox
                        label={option.label}
                        checked={active}
                        onChange={() => setAxis(axis.name, active ? undefined : option.value)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="mt-1 text-[11px] text-neutral-400">One option at a time.</p>
        </Section>
      )}

      <Section>
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
      </Section>
    </div>
  );
}
