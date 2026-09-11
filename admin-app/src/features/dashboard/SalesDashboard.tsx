import { useState } from "react";
import { CircleCheck, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeading } from "@/components/ui/Card";
import { LoadingState, ErrorState } from "@/components/ui/LoadingState";
import { formatPrice } from "@/features/product-catalog/products/money";
import {
  STATUS_LABEL as ORDER_STATUS_LABEL,
  STATUS_TONE as ORDER_STATUS_TONE,
} from "@/features/orders/statusPresentation";
import { ORDERS_ROUTES } from "@/features/orders/routePaths";
import type { OrderStatus } from "@/features/orders/types";
import { useGetSalesSummaryQuery, useGetSalesOverTimeQuery, useGetTopProductsQuery } from "./api";
import { DateRangePicker } from "./DateRangePicker";
import { DashboardBanner } from "./DashboardBanner";
import { OrdersChart } from "./OrdersChart";
import { SalesChart } from "./SalesChart";
import { StatusBreakdown, type BreakdownSegment } from "./StatusBreakdown";
import { SummaryCard } from "./SummaryCard";
import { TopProductsTable } from "./TopProductsTable";
import type { DateRangeParams } from "./types";

const isKnownOrderStatus = (key: string): key is OrderStatus => key in ORDER_STATUS_LABEL;

const titleCase = (key: string) =>
  key.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());

// Issue #174/M7.4 — order-manager/super-admin's dashboard view: stat tiles,
// a date-range control (in the header, governing all three sales queries),
// revenue + orders charts, an orders-by-status breakdown, the top-products
// table, and a link out to the full Orders screen. catalog-manager never
// renders any of this — see DashboardPage.tsx's own role branch.
export const SalesDashboard = () => {
  const [range, setRange] = useState<DateRangeParams>({});

  const summary = useGetSalesSummaryQuery(range);
  const salesOverTime = useGetSalesOverTimeQuery(range);
  const topProducts = useGetTopProductsQuery(range);

  const isLoading = summary.isLoading || salesOverTime.isLoading || topProducts.isLoading;
  const error = summary.error ?? salesOverTime.error ?? topProducts.error;

  const data = summary.data;
  const avgOrderValue =
    data && data.totalOrders > 0 ? formatPrice(data.totalRevenue / data.totalOrders) : "—";

  const orderSegments: BreakdownSegment[] = data
    ? Object.entries(data.ordersByStatus).map(([key, value]) => ({
        label: isKnownOrderStatus(key) ? ORDER_STATUS_LABEL[key] : titleCase(key),
        value,
        tone: isKnownOrderStatus(key) ? ORDER_STATUS_TONE[key] : "neutral",
      }))
    : [];

  return (
    <main className="flex min-h-full flex-col gap-4 bg-neutral-50 p-6">
      <PageHeader
        title="Dashboard"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {isLoading && <LoadingState label="Loading dashboard…" />}
      {!isLoading && error && <ErrorState message="Unable to load the dashboard." />}

      {!isLoading && !error && data && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total orders"
              value={String(data.totalOrders)}
              icon={ShoppingBag}
              accent="primary"
              hint="in the selected range"
            />
            <SummaryCard
              label="Total revenue"
              value={formatPrice(data.totalRevenue)}
              icon={Wallet}
              accent="success"
              hint="captured, net of refunds"
            />
            <SummaryCard
              label="Avg order value"
              value={avgOrderValue}
              icon={TrendingUp}
              accent="accent"
              hint="revenue ÷ orders"
            />
            <SummaryCard
              label="Paid orders"
              value={String(data.ordersByStatus.paid ?? 0)}
              icon={CircleCheck}
              accent="success"
              hint="reached payment capture"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-xl shadow-sm">
              <CardHeading>Revenue over time</CardHeading>
              {salesOverTime.data && <SalesChart series={salesOverTime.data.series} />}
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardHeading>Orders over time</CardHeading>
              {salesOverTime.data && <OrdersChart series={salesOverTime.data.series} />}
            </Card>
          </section>

          <StatusBreakdown
            title="Orders by status"
            total={data.totalOrders}
            segments={orderSegments}
          />

          <Card className="rounded-xl shadow-sm">
            <CardHeading>Top products</CardHeading>
            <TopProductsTable
              products={topProducts.data?.products ?? []}
              isFetching={topProducts.isFetching}
            />
          </Card>

          <DashboardBanner
            title="Manage orders"
            subtitle="Review, fulfil and refund customer orders."
            ctaLabel="View all orders →"
            to={ORDERS_ROUTES.list}
          />
        </>
      )}
    </main>
  );
};
