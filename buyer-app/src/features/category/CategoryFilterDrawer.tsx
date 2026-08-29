"use client";

import { useEffect, useState } from "react";
import type { CategoryProductFilters } from "@/features/products/types";
import type { CategoryFilterOptions } from "@/features/categories/types";
import { CategoryFilterRail } from "./CategoryFilterRail";

// Mobile filter affordance (FR-CAT-103) — the desktop rail is `hidden lg:block`,
// so below `lg` this button opens a slide-in drawer wrapping the same rail.
export function CategoryFilterDrawer(props: {
  filterOptions: CategoryFilterOptions | undefined;
  filters: CategoryProductFilters;
  onChange: (next: CategoryProductFilters) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const activeCount =
    (props.filters.brand?.length ?? 0) +
    (props.filters.minPrice !== undefined || props.filters.maxPrice !== undefined ? 1 : 0) +
    Object.keys(props.filters.spec ?? {}).length +
    (props.filters.attributeName ? 1 : 0) +
    (props.filters.inStock ? 1 : 0) +
    (props.filters.onSale ? 1 : 0);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-primary-600 px-1.5 text-xs text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close filters"
            className="flex-1 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="ml-auto flex h-full w-80 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Filters</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-neutral-500 hover:text-neutral-800"
              >
                Done
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CategoryFilterRail {...props} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
