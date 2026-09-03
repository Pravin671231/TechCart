import { useMemo } from "react";
import { Link } from "react-router";
import { DataTable, type DataTableColumn, type SortState } from "@/components/data-table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useListQueryState } from "@/hooks/useListQueryState";
import { formatPrice } from "@/features/product-catalog/products/money";
import { useGetOrdersQuery } from "./ordersApi";
import { ORDERS_ROUTES } from "./routePaths";
import { ORDER_STATUSES, type AdminOrder, type OrderSort, type OrderStatus } from "./types";
import { STATUS_LABEL, STATUS_TONE } from "./statusPresentation";

interface OrderFilters {
  search: string;
  status: OrderStatus | "";
  sort?: OrderSort;
}

const STATUS_OPTIONS = ORDER_STATUSES.map((value) => ({ label: STATUS_LABEL[value], value }));

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

// OrderSort is one combined string ("createdAt" | "-createdAt" | …); DataTable
// speaks { columnId, direction }. Adapt at this boundary — ordersApi.ts keeps
// splitting the combined string into ?sortBy=/?orderBy= as before.
function toSortState(sort: OrderSort | undefined): SortState | null {
  if (!sort) return null;
  return sort.startsWith("-")
    ? { columnId: sort.slice(1), direction: "desc" }
    : { columnId: sort, direction: "asc" };
}

function fromSortState(next: SortState | null): OrderSort | undefined {
  if (!next) return undefined;
  const base = next.columnId as "createdAt" | "totalAmount";
  return (next.direction === "desc" ? `-${base}` : base) as OrderSort;
}

export const OrderList = () => {
  const { filters, setFilter, page, setPage, limit, setLimit } = useListQueryState<OrderFilters>({
    search: "",
    status: "",
    sort: undefined,
  });

  const { data, isLoading, isFetching, isError, refetch } = useGetOrdersQuery({
    page,
    limit,
    sort: filters.sort,
    search: filters.search || undefined,
    status: filters.status || undefined,
  });

  const columns = useMemo<DataTableColumn<AdminOrder>[]>(
    () => [
      {
        id: "orderNumber",
        header: "Order #",
        cell: (order) => (
          <Link
            to={ORDERS_ROUTES.detail(order.id)}
            className="font-medium text-primary-600 hover:underline"
          >
            {order.orderNumber}
          </Link>
        ),
      },
      {
        id: "buyer",
        header: "Buyer",
        cell: (order) => order.buyer?.email ?? "—",
      },
      {
        id: "createdAt",
        header: "Date",
        sortable: true,
        cell: (order) => formatDate(order.createdAt),
      },
      {
        id: "status",
        header: "Status",
        cell: (order) => (
          <StatusBadge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</StatusBadge>
        ),
      },
      {
        id: "totalAmount",
        header: "Total",
        sortable: true,
        align: "right",
        cell: (order) => formatPrice(order.totalAmount),
      },
    ],
    [],
  );

  const orders = data?.items ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <DataTable<AdminOrder>
      className="mt-4 min-h-0 flex-1"
      columns={columns}
      rows={orders}
      getRowId={(order) => order.id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      onRetry={refetch}
      emptyMessage="No orders found."
      caption="Order list"
      minWidth="44rem"
      search={{
        label: "Search orders",
        placeholder: "Search order # or buyer email…",
        defaultValue: filters.search,
        onSearch: (value) => setFilter("search", value),
      }}
      filters={{
        fields: [
          {
            type: "select",
            key: "status",
            label: "Status",
            placeholder: "Status: All",
            options: STATUS_OPTIONS,
          },
        ],
        values: { status: filters.status },
        onChange: (_key, value) => setFilter("status", value as OrderStatus | ""),
      }}
      sort={toSortState(filters.sort)}
      onSortChange={(next) => setFilter("sort", fromSortState(next))}
      pagination={{ page, pageSize: limit, total }}
      onPaginationChange={({ page: nextPage, pageSize }) => {
        if (pageSize !== limit) setLimit(pageSize);
        else setPage(nextPage);
      }}
    />
  );
};
