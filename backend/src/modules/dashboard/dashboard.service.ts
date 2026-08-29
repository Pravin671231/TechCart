import { getOrSetCache } from "@/lib/cache";
import {
  generateBucketKeys,
  resolveBucket,
  resolveDateRange,
  toIsoRange,
  type DateRange,
} from "@/utils/dateRange";
import {
  countAndRevenueInRange,
  salesOverTimeInRange,
  topProductsInRange,
} from "@/modules/orders/orders.repository";
import { sumCapturedInRange, sumRefundsInRange } from "@/modules/payments/payments.repository";
import { countByStatusGroups } from "@/modules/product-catalog/features/products/products.repository";
import { countTotalsByStatus as countCategoryTotals } from "@/modules/product-catalog/features/categories/categories.repository";
import { countTotalsByStatus as countBrandTotals } from "@/modules/product-catalog/features/brands/brands.repository";

const CACHE_TTL_SECONDS = 60;

// FR-DASH-016 (corrected — see M7 plan) — dashboard responses are whole
// rupees, matching every other feature in this codebase except payments
// itself. payments.amount/refunds[].amount are integer paise; this is the
// one conversion point for every dashboard figure sourced from them.
function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export type SalesSummary = {
  range: { from: string; to: string };
  totalOrders: number;
  totalRevenue: number;
  ordersByStatus: Record<string, number>;
};

// FR-DASH-001/003/004 — totalRevenue is captured payments within the range
// minus refunds processed within that same range, net of both, in rupees.
export async function getSalesSummary(from?: string, to?: string): Promise<SalesSummary> {
  const range = resolveDateRange(from, to);
  const key = `dashboard:sales-summary:${range.from.toISOString()}:${range.to.toISOString()}`;

  return getOrSetCache(key, CACHE_TTL_SECONDS, async () => {
    const [{ totalOrders, ordersByStatus }, capturedPaise, refundedPaise] = await Promise.all([
      countAndRevenueInRange(range.from, range.to),
      sumCapturedInRange(range.from, range.to),
      sumRefundsInRange(range.from, range.to),
    ]);

    return {
      range: toIsoRange(range),
      totalOrders,
      totalRevenue: paiseToRupees(capturedPaise - refundedPaise),
      ordersByStatus,
    };
  });
}

export type SalesOverTime = {
  range: { from: string; to: string };
  bucket: "day" | "week";
  series: { date: string; revenue: number; orders: number }[];
};

// FR-DASH-005/018 — zero-filled gaps between every bucket in the range, not
// just the ones the aggregation actually matched.
export async function getSalesOverTime(from?: string, to?: string): Promise<SalesOverTime> {
  const range = resolveDateRange(from, to);
  const bucket = resolveBucket(range);
  const key = `dashboard:sales-over-time:${range.from.toISOString()}:${range.to.toISOString()}`;

  return getOrSetCache(key, CACHE_TTL_SECONDS, async () => {
    const rows = await salesOverTimeInRange(range.from, range.to, bucket);
    const byDate = new Map(rows.map((row) => [row.date, row]));
    const series = generateBucketKeys(range, bucket).map((date) => {
      const row = byDate.get(date);
      return { date, revenue: row?.revenue ?? 0, orders: row?.orders ?? 0 };
    });

    return { range: toIsoRange(range), bucket, series };
  });
}

export type TopProduct = {
  productId: string;
  name: string;
  slug: string;
  unitsSold: number;
  revenue: number;
};

export type TopProducts = {
  range: { from: string; to: string };
  products: TopProduct[];
};

const TOP_PRODUCTS_LIMIT = 10;

// FR-DASH-006/017 — top 10 products by revenue within the range, tiebroken
// by units sold (already ordered that way by the repository's own $sort).
export async function getTopProducts(from?: string, to?: string): Promise<TopProducts> {
  const range = resolveDateRange(from, to);
  const key = `dashboard:top-products:${range.from.toISOString()}:${range.to.toISOString()}`;

  return getOrSetCache(key, CACHE_TTL_SECONDS, async () => {
    const rows = await topProductsInRange(range.from, range.to, TOP_PRODUCTS_LIMIT);
    return { range: toIsoRange(range), products: rows };
  });
}

export type CatalogSummary = {
  totalProducts: number;
  productsByStatus: Record<string, number>;
  totalCategories: number;
  activeCategories: number;
  totalBrands: number;
  activeBrands: number;
};

const CATALOG_SUMMARY_CACHE_KEY = "dashboard:catalog-summary";

// FR-DASH-007/020/021 — a live snapshot, not range-scoped and no
// denormalized counter anywhere. Deliberately carries no outOfStockCount
// field at all — that's SRS v0.10 (Inventory Management), not yet built; see
// the M7 plan's own scope boundary.
export async function getCatalogSummary(): Promise<CatalogSummary> {
  return getOrSetCache(CATALOG_SUMMARY_CACHE_KEY, CACHE_TTL_SECONDS, async () => {
    const [productsByStatus, categoryTotals, brandTotals] = await Promise.all([
      countByStatusGroups(),
      countCategoryTotals(),
      countBrandTotals(),
    ]);

    const totalProducts = Object.values(productsByStatus).reduce((sum, count) => sum + count, 0);

    return {
      totalProducts,
      productsByStatus,
      totalCategories: categoryTotals.total,
      activeCategories: categoryTotals.active,
      totalBrands: brandTotals.total,
      activeBrands: brandTotals.active,
    };
  });
}

export type { DateRange };
