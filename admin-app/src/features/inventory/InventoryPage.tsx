import { PageHeader } from "@/components/layout/PageHeader";
import { useListQueryState } from "@/hooks/useListQueryState";
import { InventoryList } from "./InventoryList";

interface InventoryFilters {
  search: string;
  warehouseId: string;
}

export const InventoryPage = () => {
  const { filters, setFilter, page, setPage } = useListQueryState<InventoryFilters>({
    search: "",
    warehouseId: "",
  });

  return (
    <main className="p-6">
      <PageHeader title="Inventory" />

      <InventoryList
        search={filters.search}
        onSearchChange={(value) => setFilter("search", value)}
        warehouseId={filters.warehouseId}
        onWarehouseChange={(value) => setFilter("warehouseId", value)}
        page={page}
        onPageChange={setPage}
      />
    </main>
  );
};
