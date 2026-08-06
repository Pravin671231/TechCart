"use client";

import { useState } from "react";
import { useGetCategoryProductsQuery } from "@/features/products/api";
import type { CategoryProductFilters, ProductSort } from "@/features/products/types";
import { ProductListEmpty } from "@/features/products/ProductListEmpty";
import { ProductListError } from "@/features/products/ProductListError";
import { Pagination, describeRange } from "@/features/products/Pagination";
import { SortSelect } from "@/features/products/SortSelect";
import { useGetCategoriesQuery } from "@/features/categories/api";
import { useGetBrandsQuery } from "@/features/brands/api";
import type { NormalizedApiError } from "@/store/api";
import { CategoryBreadcrumb, resolveBreadcrumb } from "./CategoryBreadcrumb";
import { CategoryFilterRail } from "./CategoryFilterRail";
import { CategoryListSkeleton } from "./CategoryListSkeleton";
import { CategoryNotFound } from "./CategoryNotFound";
import { CategoryProductList } from "./CategoryProductList";

export function CategoryContent({ slug }: { slug: string }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>("newest");
  const [filters, setFilters] = useState<CategoryProductFilters>({});

  const { data, isLoading, isError, error, refetch } = useGetCategoryProductsQuery({
    slug,
    page,
    sort,
    ...filters,
  });
  const { data: categories } = useGetCategoriesQuery();
  const { data: brands } = useGetBrandsQuery();

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

  if (isNotFound) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6">
        <CategoryNotFound />
      </main>
    );
  }

  const breadcrumb = resolveBreadcrumb(categories, slug);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6">
      <CategoryBreadcrumb breadcrumb={breadcrumb} />
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-neutral-900">
        {breadcrumb?.current.name ?? slug}
      </h1>
      <div className="flex gap-6">
        <CategoryFilterRail brands={brands ?? []} filters={filters} onChange={handleFilterChange} />
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
            <p className="text-sm text-neutral-500">
              {data ? describeRange(data.pagination) : "Loading products…"}
            </p>
            <SortSelect value={sort} onChange={handleSortChange} />
          </div>

          {isLoading ? (
            <CategoryListSkeleton />
          ) : isError ? (
            <ProductListError onRetry={refetch} />
          ) : data && data.items.length === 0 ? (
            <ProductListEmpty />
          ) : (
            data && <CategoryProductList products={data.items} />
          )}

          {data && data.pagination.totalPages > 1 && (
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          )}
        </section>
      </div>
    </main>
  );
}
