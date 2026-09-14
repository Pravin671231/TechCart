"use client";

import { useState } from "react";
import { FetchingOverlay } from "@/components/ui/FetchingOverlay";
import { ProductListError } from "@/features/products/ProductListError";
import { Pagination } from "@/features/products/Pagination";
import type { Pagination as PaginationData } from "@/store/api";
import { useGetOrdersQuery } from "./api";
import { OrderRow } from "./OrderRow";
import { OrdersEmpty } from "./OrdersEmpty";
import { OrdersSkeleton } from "./OrdersSkeleton";

// Products/Pagination.tsx's own describeRange is hardcoded to "products" —
// this feature needs the identical range math with "orders" copy instead.
function describeOrdersRange(pagination: PaginationData): string {
  if (pagination.total === 0) return "Showing 0 orders";
  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);
  return `Showing ${start}–${end} of ${pagination.total} orders`;
}

// feature/buyer-app-account-sidebar-shell — session guard moved to
// AccountShell; PageContainer's own <main> dropped for a plain div (see
// AddressListContent.tsx's identical note).
export function OrderHistoryContent() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError, refetch } = useGetOrdersQuery({ page });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Your orders</h1>

      {isError ? (
        <ProductListError onRetry={refetch} message="Something went wrong loading your orders." />
      ) : isLoading || !data ? (
        <OrdersSkeleton />
      ) : data.items.length === 0 ? (
        <OrdersEmpty />
      ) : (
        <FetchingOverlay isFetching={isFetching && !isLoading}>
          <p className="mb-4 text-sm text-neutral-500">{describeOrdersRange(data.pagination)}</p>
          <div className="flex flex-col gap-4">
            {data.items.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
          {data.pagination.totalPages > 1 && (
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          )}
        </FetchingOverlay>
      )}
    </div>
  );
}
