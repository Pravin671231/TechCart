"use client";

import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useInfiniteScrollSentinel } from "@/hooks/useInfiniteScrollSentinel";
import { useGetProductsQuery } from "@/features/products/api";
import type { ProductSort } from "@/features/products/types";
import { ProductGrid } from "@/features/products/ProductGrid";
import { ProductListSkeleton } from "@/features/products/ProductListSkeleton";
import { ProductListEmpty } from "@/features/products/ProductListEmpty";
import { ProductListError } from "@/features/products/ProductListError";
import { InfiniteScrollFooter } from "@/features/products/InfiniteScrollFooter";
import { describeLoadedCount } from "@/features/products/Pagination";
import { SortSelect } from "@/features/products/SortSelect";

export function HomeContent() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>("newest");

  const { data, isLoading, isFetching, isError, refetch } = useGetProductsQuery({ page, sort });

  const hasNextPage = data?.pagination.hasNextPage ?? false;
  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage,
    isFetching: isLoading || isFetching,
    onLoadMore: () => setPage((current) => current + 1),
  });

  function handleSortChange(next: ProductSort) {
    setSort(next);
    setPage(1);
  }

  return (
    <PageContainer className="flex flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <p className="text-sm text-neutral-500">
          {data
            ? describeLoadedCount(data.items.length, data.pagination.total)
            : "Loading products…"}
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
        data && (
          <>
            <ProductGrid products={data.items} />
            <InfiniteScrollFooter
              sentinelRef={sentinelRef}
              isLoadingMore={isFetching && page > 1}
              hasNextPage={hasNextPage}
              hasItems={data.items.length > 0}
            />
          </>
        )
      )}
    </PageContainer>
  );
}
