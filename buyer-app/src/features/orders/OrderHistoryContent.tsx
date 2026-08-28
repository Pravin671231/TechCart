"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductListError } from "@/features/products/ProductListError";
import { Pagination } from "@/features/products/Pagination";
import type { Pagination as PaginationData } from "@/store/api";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
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

export function OrderHistoryContent() {
  const router = useRouter();
  const { data: session } = useGetSessionQuery();
  const [page, setPage] = useState(1);

  // Same inverted guard as CartContent/AddressListContent/CheckoutContent.
  useEffect(() => {
    if (session === null) {
      router.push("/sign-in?redirect=/orders");
    }
  }, [session, router]);

  const { data, isLoading, isError, refetch } = useGetOrdersQuery({ page }, { skip: !session });

  return (
    <PageContainer className="flex flex-col">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Your orders</h1>

      {session === null ? null : isError ? (
        <ProductListError onRetry={refetch} message="Something went wrong loading your orders." />
      ) : session === undefined || isLoading || !data ? (
        <OrdersSkeleton />
      ) : data.items.length === 0 ? (
        <OrdersEmpty />
      ) : (
        <>
          <p className="mb-4 text-sm text-neutral-500">{describeOrdersRange(data.pagination)}</p>
          <div className="flex flex-col gap-4">
            {data.items.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
          {data.pagination.totalPages > 1 && (
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          )}
        </>
      )}
    </PageContainer>
  );
}
