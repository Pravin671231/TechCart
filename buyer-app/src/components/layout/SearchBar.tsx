"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGetProductSuggestionsQuery } from "@/features/products/api";
import { useSearchCategoriesQuery } from "@/features/categories/api";

const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 5;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function SearchBar() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debounced = useDebouncedValue(term, 200);
  const trimmed = debounced.trim();
  const enabled = trimmed.length >= MIN_QUERY_LENGTH;

  const { data: products } = useGetProductSuggestionsQuery(trimmed, { skip: !enabled });
  const { data: categories } = useSearchCategoriesQuery(trimmed, { skip: !enabled });

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

  function goToResults(query: string) {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    goToResults(term);
  }

  function dismiss() {
    setOpen(false);
    setTerm("");
  }

  const productMatches = (products ?? []).slice(0, MAX_SUGGESTIONS);
  const categoryMatches = (categories ?? []).slice(0, MAX_SUGGESTIONS);
  const showDropdown =
    open && enabled && (productMatches.length > 0 || categoryMatches.length > 0);

  return (
    <div ref={containerRef} className="relative flex flex-1">
      <form onSubmit={handleSubmit} className="flex flex-1" role="search">
        <input
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search products…"
          aria-label="Search products"
          className="flex-1 bg-transparent px-3 text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex items-center px-3 text-neutral-400 hover:text-neutral-600"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      </form>

      {showDropdown && (
        <div className="absolute top-[80%] right-0 left-0 z-30 mt-2 overflow-hidden rounded-b-lg border border-neutral-300 bg-white py-1 shadow-2xl">
          {categoryMatches.length > 0 && (
            <div className="py-1">
              <p className="px-3 py-1 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                Categories
              </p>
              {categoryMatches.map((category) => (
                <Link
                  key={category._id}
                  href={`/category/${category.slug}`}
                  onClick={dismiss}
                  className="block px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          )}

          {productMatches.length > 0 && (
            <div className="border-t border-neutral-100 py-1 first:border-t-0">
              <p className="px-3 py-1 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                Products
              </p>
              {productMatches.map((product) => (
                <Link
                  key={product._id}
                  href={`/products/${product.slug}`}
                  onClick={dismiss}
                  className="block px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  {product.name}
                </Link>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => goToResults(term)}
            className="block w-full border-t border-neutral-100 px-3 py-2 text-left text-xs font-medium text-primary-600 hover:bg-neutral-50"
          >
            See all results for “{trimmed}”
          </button>
        </div>
      )}
    </div>
  );
}
