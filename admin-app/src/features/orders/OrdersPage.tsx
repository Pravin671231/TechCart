import { PageHeader } from "@/components/layout/PageHeader";
import { useListQueryState } from "@/hooks/useListQueryState";
import { OrderList } from "./OrderList";
import type { OrderSort, OrderStatus } from "./types";

interface OrderFilters {
  search: string;
  status: OrderStatus | "";
  sort?: OrderSort;
}

export const OrdersPage = () => {
  const { filters, setFilter, page, setPage } = useListQueryState<OrderFilters>({
    search: "",
    status: "",
    sort: undefined,
  });

  return (
    <main className="p-6">
      <PageHeader title="Orders" />

      <OrderList
        search={filters.search}
        onSearchChange={(value) => setFilter("search", value)}
        status={filters.status}
        onStatusChange={(value) => setFilter("status", value)}
        sort={filters.sort}
        onSortChange={(value) => setFilter("sort", value)}
        page={page}
        onPageChange={setPage}
      />
    </main>
  );
};
