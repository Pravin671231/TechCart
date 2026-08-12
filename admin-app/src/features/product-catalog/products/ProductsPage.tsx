import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useListQueryState } from "@/hooks/useListQueryState";
import { ProductList } from "./ProductList";
import type { ProductSort, ProductStatus } from "./types";

interface ProductFilters {
  search: string;
  status: ProductStatus | "";
  lowStockOnly: boolean;
  sort?: ProductSort;
}

export const ProductsPage = () => {
  const { filters, setFilter, page, setPage } = useListQueryState<ProductFilters>({
    search: "",
    status: "",
    lowStockOnly: false,
    sort: undefined,
  });

  return (
    <main className="p-6">
      <PageHeader
        title="Products"
        actions={<LinkButton to="/products/new">+ New product</LinkButton>}
      />

      <ProductList
        search={filters.search}
        onSearchChange={(value) => setFilter("search", value)}
        status={filters.status}
        onStatusChange={(value) => setFilter("status", value)}
        lowStockOnly={filters.lowStockOnly}
        onLowStockOnlyChange={(value) => setFilter("lowStockOnly", value)}
        sort={filters.sort}
        onSortChange={(value) => setFilter("sort", value)}
        page={page}
        onPageChange={setPage}
      />
    </main>
  );
};
