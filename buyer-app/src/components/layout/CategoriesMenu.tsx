"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGetCategoriesQuery } from "@/features/categories/api";
import type { PublicCategory } from "@/features/categories/types";
import { ChevronDown } from "lucide-react";

// Issue #322 — parent (root) categories only; buyers drill into
// subcategories on the category page itself.
function rootCategories(categories: PublicCategory[]): PublicCategory[] {
  return categories
    .filter((category) => category.parentCategory === null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function CategoriesMenu() {
  const { data: categories } = useGetCategoriesQuery();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const roots = useMemo(() => rootCategories(categories ?? []), [categories]);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded-l-md border-r border-neutral-300 bg-neutral-50 px-3 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
      >
        All Categories <span className="text-neutral-400"><ChevronDown size={16} /> </span>
      </button>

      {open && roots.length > 0 && (
        <div
          role="menu"
          className="absolute top-[90%] -left-1 z-50 max-h-[70vh] w-32 overflow-y-auto rounded-lg border border-neutral-300 bg-white p-2 shadow-2xl"
        >
          {roots.map((category) => (
            <Link
              key={category._id}
              href={`/category/${category.slug}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              {category.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
