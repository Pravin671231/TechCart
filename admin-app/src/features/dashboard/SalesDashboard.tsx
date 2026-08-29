import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeading } from "@/components/ui/Card";
import { LoadingState, ErrorState } from "@/components/ui/LoadingState";
import { formatPrice } from "@/features/product-catalog/products/money";
import { useGetSalesSummaryQuery, useGetSalesOverTimeQuery, useGetTopProductsQuery } from "./api";
import { DateRangePicker } from "./DateRangePicker";
import { SalesChart } from "./SalesChart";
import { SummaryCard } from "./SummaryCard";
import { TopProductsTable } from "./TopProductsTable";
import type { DateRangeParams } from "./types";

// Issue #174/M7.4 — order-manager/super-admin's dashboard view: summary
// cards, a date-range control that re-triggers all three sales queries,
// a revenue chart, and the top-products table. catalog-manager never
// renders any of this — see DashboardPage.tsx's own role branch.
export const SalesDashboard = () => {
  const [range, setRange] = useState<DateRangeParams>({});

  const summary = useGetSalesSummaryQuery(range);
  const salesOverTime = useGetSalesOverTimeQuery(range);
  const topProducts = useGetTopProductsQuery(range);

  const isLoading = summary.isLoading || salesOverTime.isLoading || topProducts.isLoading;
  const error = summary.error ?? salesOverTime.error ?? topProducts.error;

  return (
    <main className="p-6">
      <PageHeader title="Dashboard" />
      <div className="mb-6">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {isLoading && <LoadingState label="Loading dashboard…" />}
      {!isLoading && error && <ErrorState message="Unable to load the dashboard." />}

      {!isLoading && !error && summary.data && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard label="Total orders" value={String(summary.data.totalOrders)} />
            <SummaryCard label="Total revenue" value={formatPrice(summary.data.totalRevenue)} />
            <Card>
              <CardHeading>Orders by status</CardHeading>
              <ul className="space-y-1 text-sm text-neutral-700">
                {Object.entries(summary.data.ordersByStatus).map(([status, count]) => (
                  <li key={status} className="flex justify-between">
                    <span className="capitalize">{status.replace(/_/g, " ")}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeading>Revenue over time</CardHeading>
            {salesOverTime.data && <SalesChart series={salesOverTime.data.series} />}
          </Card>

          <Card>
            <CardHeading>Top products</CardHeading>
            <TopProductsTable
              products={topProducts.data?.products ?? []}
              isFetching={topProducts.isFetching}
            />
          </Card>
        </>
      )}
    </main>
  );
};
