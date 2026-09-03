"use client";

import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useSearchProductsQuery } from "@/features/products/api";
import type { SearchProductFilters, SearchProductSort } from "@/features/products/types";
import { ProductGrid } from "@/features/products/ProductGrid";
import { ProductListSkeleton } from "@/features/products/ProductListSkeleton";
import { ProductListError } from "@/features/products/ProductListError";
import { Pagination, describeRange } from "@/features/products/Pagination";
import { FetchingOverlay } from "@/components/ui/FetchingOverlay";
import { useGetCategoriesQuery } from "@/features/categories/api";
import { useGetBrandsQuery } from "@/features/brands/api";
import { SearchEmpty } from "./SearchEmpty";
import { SearchFilterRail } from "./SearchFilterRail";
import { SearchSortSelect } from "./SearchSortSelect";

function hasActiveFilters(filters: SearchProductFilters): boolean {
  return Boolean(
    filters.category ||
      (filters.brand && filters.brand.length > 0) ||
      filters.minPrice !== undefined ||
      filters.maxPrice !== undefined ||
      filters.inStock ||
      filters.onSale,
  );
}

export function SearchContent({ q }: { q: string }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SearchProductSort>("relevance");
  const [filters, setFilters] = useState<SearchProductFilters>({});

  const { data, isLoading, isFetching, isError, refetch } = useSearchProductsQuery(
    { q, page, sort, ...filters },
    { skip: q.length === 0 },
  );
  const { data: categories } = useGetCategoriesQuery();
  const { data: brands } = useGetBrandsQuery();

  function handleFilterChange(next: SearchProductFilters) {
    setFilters(next);
    setPage(1);
  }

  function handleSortChange(next: SearchProductSort) {
    setSort(next);
    setPage(1);
  }

  if (q.length === 0) {
    return (
      <PageContainer className="flex flex-col">
        <p className="text-sm text-neutral-500">Enter a search term to find products.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
        Results for <span className="text-neutral-500">&ldquo;{q}&rdquo;</span>
      </h1>
      <div className="mt-4 flex gap-6">
        <SearchFilterRail
          categories={categories ?? []}
          brands={brands ?? []}
          filters={filters}
          onChange={handleFilterChange}
        />
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
            <p className="text-sm text-neutral-500">
              {data ? describeRange(data.pagination) : "Loading products…"}
            </p>
            <SearchSortSelect value={sort} onChange={handleSortChange} />
          </div>

          {isLoading ? (
            <ProductListSkeleton />
          ) : isError ? (
            <ProductListError onRetry={refetch} />
          ) : data && data.items.length === 0 ? (
            <SearchEmpty q={q} hasActiveFilters={hasActiveFilters(filters)} />
          ) : (
            data && (
              <FetchingOverlay isFetching={isFetching && !isLoading}>
                <ProductGrid products={data.items} />
                {data.pagination.totalPages > 1 && (
                  <Pagination pagination={data.pagination} onPageChange={setPage} />
                )}
              </FetchingOverlay>
            )
          )}
        </section>
      </div>
    </PageContainer>
  );
}
