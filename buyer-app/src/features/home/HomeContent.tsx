"use client";

import { useState } from "react";
import { useGetProductsQuery } from "@/features/products/api";
import type { ProductSort } from "@/features/products/types";
import { ProductGrid } from "@/features/products/ProductGrid";
import { ProductListSkeleton } from "@/features/products/ProductListSkeleton";
import { ProductListEmpty } from "@/features/products/ProductListEmpty";
import { ProductListError } from "@/features/products/ProductListError";
import { Pagination, describeRange } from "@/features/products/Pagination";
import { SortSelect } from "@/features/products/SortSelect";

export function HomeContent() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>("newest");

  const { data, isLoading, isError, refetch } = useGetProductsQuery({ page, sort });

  function handleSortChange(next: ProductSort) {
    setSort(next);
    setPage(1);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <p className="text-sm text-neutral-500">
          {data ? describeRange(data.pagination) : "Loading products…"}
        </p>
        <SortSelect value={sort} onChange={handleSortChange} />
      </div>

      {isLoading ? (
        <ProductListSkeleton />
      ) : isError ? (
        <ProductListError onRetry={refetch} />
      ) : data && data.items.length === 0 ? (
        <ProductListEmpty />
      ) : (
        data && <ProductGrid products={data.items} />
      )}

      {data && data.pagination.totalPages > 1 && (
        <Pagination pagination={data.pagination} onPageChange={setPage} />
      )}
    </main>
  );
}
