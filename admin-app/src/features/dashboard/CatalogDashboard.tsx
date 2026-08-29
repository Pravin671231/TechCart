import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState, ErrorState } from "@/components/ui/LoadingState";
import { useGetCatalogSummaryQuery } from "./api";
import { SummaryCard } from "./SummaryCard";

// Issue #174/M7.4 — catalog-manager's dashboard view: narrower catalog-only
// cards, no date-range control, no chart, no sales/revenue widgets at all
// (matching the backend's own role-exclusive catalog-summary endpoint).
export const CatalogDashboard = () => {
  const { data, isLoading, error } = useGetCatalogSummaryQuery();

  return (
    <main className="p-6">
      <PageHeader title="Dashboard" />

      {isLoading && <LoadingState label="Loading dashboard…" />}
      {!isLoading && error && <ErrorState message="Unable to load the dashboard." />}

      {!isLoading && !error && data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard label="Total products" value={String(data.totalProducts)} />
          <SummaryCard
            label="Published products"
            value={String(data.productsByStatus.published ?? 0)}
          />
          <SummaryCard label="Draft products" value={String(data.productsByStatus.draft ?? 0)} />
          <SummaryCard
            label="Categories"
            value={`${data.activeCategories} active / ${data.totalCategories} total`}
          />
          <SummaryCard
            label="Brands"
            value={`${data.activeBrands} active / ${data.totalBrands} total`}
          />
        </div>
      )}
    </main>
  );
};
