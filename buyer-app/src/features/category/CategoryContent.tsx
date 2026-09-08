"use client";

import { useState } from "react";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { FetchingOverlay } from "@/components/ui/FetchingOverlay";
import { useGetCategoryProductsQuery } from "@/features/products/api";
import type { CategoryProductFilters, ProductSort } from "@/features/products/types";
import { ProductListEmpty } from "@/features/products/ProductListEmpty";
import { ProductListError } from "@/features/products/ProductListError";
import { Pagination, describeRange } from "@/features/products/Pagination";
import { SortSelect } from "@/features/products/SortSelect";
import { useGetCategoriesQuery, useGetCategoryFiltersQuery } from "@/features/categories/api";
import type { NormalizedApiError } from "@/store/api";
import { CategoryBreadcrumb, resolveBreadcrumb } from "./CategoryBreadcrumb";
import { CategoryFilterRail } from "./CategoryFilterRail";
import { CategoryFilterDrawer } from "./CategoryFilterDrawer";
import { CategoryListSkeleton } from "./CategoryListSkeleton";
import { CategoryProductList } from "./CategoryProductList";

export function CategoryContent({ slug }: { slug: string }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>("newest");
  const [filters, setFilters] = useState<CategoryProductFilters>({});

  const { data, isLoading, isFetching, isError, error, refetch } = useGetCategoryProductsQuery({
    slug,
    page,
    sort,
    ...filters,
  });
  const { data: categories } = useGetCategoriesQuery();
  const { data: filterOptions } = useGetCategoryFiltersQuery(slug);

  const isNotFound =
    isError && (error as NormalizedApiError | undefined)?.code === "CATEGORY_NOT_FOUND";

  function handleFilterChange(next: CategoryProductFilters) {
    setFilters(next);
    setPage(1);
  }

  function handleSortChange(next: ProductSort) {
    setSort(next);
    setPage(1);
  }

  // Issue #346 — the category page is the one `container-fluid` route: edge-to-edge,
  // dropping the shared `max-w-7xl` PageContainer. `AppShell` already renders the
  // `<main>` landmark, so this is a plain `<div>`.
  const pageWrapper = "flex w-full flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8";

  if (isNotFound) {
    return (
      <div className={pageWrapper}>
        <NotFoundState message="This category doesn't exist or is no longer available." />
      </div>
    );
  }

  const breadcrumb = resolveBreadcrumb(categories, slug);

  return (
    <div className={pageWrapper}>
      <CategoryBreadcrumb breadcrumb={breadcrumb} />
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-neutral-900">
        {breadcrumb?.current.name ?? slug}
      </h1>
      <div className="flex items-start gap-6">
        <aside className="hidden w-64 shrink-0 lg:sticky lg:top-8 lg:block  lg:self-start  lg:pr-4">
          <CategoryFilterRail
            filterOptions={filterOptions}
            filters={filters}
            onChange={handleFilterChange}
          />
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
            <div className="flex items-center gap-3">
              <CategoryFilterDrawer
                filterOptions={filterOptions}
                filters={filters}
                onChange={handleFilterChange}
              />
              <p className="text-sm text-neutral-500">
                {data ? describeRange(data.pagination) : "Loading products…"}
              </p>
            </div>
            <SortSelect value={sort} onChange={handleSortChange} />
          </div>

          {isLoading ? (
            <CategoryListSkeleton />
          ) : isError ? (
            <ProductListError onRetry={refetch} />
          ) : data && data.items.length === 0 ? (
            <ProductListEmpty />
          ) : (
            data && (
              <FetchingOverlay isFetching={isFetching && !isLoading}>
                <CategoryProductList products={data.items} />
                {data.pagination.totalPages > 1 && (
                  <Pagination pagination={data.pagination} onPageChange={setPage} />
                )}
              </FetchingOverlay>
            )
          )}
        </section>
      </div>
    </div>
  );
}
