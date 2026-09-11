import { CheckCircle2, FolderTree, Package, Tag } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState, ErrorState } from "@/components/ui/LoadingState";
import {
  STATUS_LABEL as PRODUCT_STATUS_LABEL,
  STATUS_TONE as PRODUCT_STATUS_TONE,
} from "@/features/product-catalog/products/statusPresentation";
import { PRODUCT_CATALOG_ROUTES } from "@/features/product-catalog/routePaths";
import type { ProductStatus } from "@/features/product-catalog/products/types";
import { useGetCatalogSummaryQuery } from "./api";
import { DashboardBanner } from "./DashboardBanner";
import { StatusBreakdown, type BreakdownSegment } from "./StatusBreakdown";
import { SummaryCard } from "./SummaryCard";

const isKnownProductStatus = (key: string): key is ProductStatus => key in PRODUCT_STATUS_LABEL;

const titleCase = (key: string) =>
  key.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());

// Issue #174/M7.4 — catalog-manager's dashboard view: catalog-only stat
// tiles, a products-by-status breakdown, and a link out to the Products
// screen. No date-range control, no chart, no sales/revenue widgets at all
// (matching the backend's own role-exclusive catalog-summary endpoint).
export const CatalogDashboard = () => {
  const { data, isLoading, error } = useGetCatalogSummaryQuery();

  const productSegments: BreakdownSegment[] = data
    ? Object.entries(data.productsByStatus).map(([key, value]) => ({
        label: isKnownProductStatus(key) ? PRODUCT_STATUS_LABEL[key] : titleCase(key),
        value,
        tone: isKnownProductStatus(key) ? PRODUCT_STATUS_TONE[key] : "neutral",
      }))
    : [];

  return (
    <main className="flex min-h-full flex-col gap-4 bg-neutral-50 p-6 dark:bg-neutral-950">
      <PageHeader title="Dashboard" />

      {isLoading && <LoadingState label="Loading dashboard…" />}
      {!isLoading && error && <ErrorState message="Unable to load the dashboard." />}

      {!isLoading && !error && data && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total products"
              value={String(data.totalProducts)}
              icon={Package}
              accent="primary"
              hint="across all statuses"
            />
            <SummaryCard
              label="Published products"
              value={String(data.productsByStatus.published ?? 0)}
              icon={CheckCircle2}
              accent="success"
              hint={`${data.productsByStatus.draft ?? 0} drafts`}
            />
            <SummaryCard
              label="Categories"
              value={`${data.activeCategories} active`}
              icon={FolderTree}
              accent="accent"
              hint={`of ${data.totalCategories} total`}
            />
            <SummaryCard
              label="Brands"
              value={`${data.activeBrands} active`}
              icon={Tag}
              accent="primary"
              hint={`of ${data.totalBrands} total`}
            />
          </section>

          <StatusBreakdown
            title="Products by status"
            total={data.totalProducts}
            segments={productSegments}
          />

          <DashboardBanner
            title="Manage catalog"
            subtitle="Add and edit products, categories and brands."
            ctaLabel="Manage products →"
            to={PRODUCT_CATALOG_ROUTES.products.list}
          />
        </>
      )}
    </main>
  );
};
