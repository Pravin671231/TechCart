import { Link } from "react-router";
import { LoadingState } from "@/components/ui/LoadingState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/form/SearchInput";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyRow, Table, TableHeadRow } from "@/components/ui/Table";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatPrice } from "@/features/product-catalog/products/money";
import { useGetOrdersQuery } from "./ordersApi";
import { ORDERS_ROUTES } from "./routePaths";
import { ORDER_STATUSES, type OrderSort, type OrderStatus } from "./types";
import { STATUS_LABEL, STATUS_TONE } from "./statusPresentation";

export interface OrderListProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: OrderStatus | "";
  onStatusChange: (value: OrderStatus | "") => void;
  sort: OrderSort | undefined;
  onSortChange: (sort: OrderSort | undefined) => void;
  page: number;
  onPageChange: (page: number) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export const OrderList = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  page,
  onPageChange,
}: OrderListProps) => {
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isFetching } = useGetOrdersQuery({
    page,
    sort,
    search: debouncedSearch || undefined,
    status: status || undefined,
  });

  const orders = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <section className="min-w-0 flex-1">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          id="order-search"
          label="Search orders"
          placeholder="Search order # or buyer email…"
          value={search}
          onChange={onSearchChange}
          width="w-80"
        />
        <label htmlFor="order-status" className="sr-only">
          Status
        </label>
        <select
          id="order-status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as OrderStatus | "")}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-600"
        >
          <option value="">Status: All</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading…" spaced={false} />
      ) : (
        <Table minWidthClassName="min-w-[700px]" isFetching={isFetching}>
          <TableHeadRow variant="shaded">
            <th className="px-3 py-2 font-medium text-neutral-500">Order #</th>
            <th className="px-3 py-2 font-medium text-neutral-500">Buyer</th>
            <SortableHeader<OrderSort>
              label="Date"
              sortKeyAsc="createdAt"
              sortKeyDesc="-createdAt"
              currentSort={sort}
              onSortChange={onSortChange}
            />
            <th className="px-3 py-2 font-medium text-neutral-500">Status</th>
            <SortableHeader<OrderSort>
              label="Total"
              sortKeyAsc="totalAmount"
              sortKeyDesc="-totalAmount"
              currentSort={sort}
              onSortChange={onSortChange}
              align="right"
            />
          </TableHeadRow>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-3 py-2 font-medium text-neutral-900">
                  <Link to={ORDERS_ROUTES.detail(order.id)} className="hover:underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">{order.buyer?.email ?? "—"}</td>
                <td className="px-3 py-2">{formatDate(order.createdAt)}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={STATUS_TONE[order.status]}>
                    {STATUS_LABEL[order.status]}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums text-neutral-900">
                  {formatPrice(order.totalAmount)}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <EmptyRow colSpan={5} message="No orders found." />}
          </tbody>
        </Table>
      )}

      {pagination && <Pagination page={page} pagination={pagination} onPageChange={onPageChange} />}
    </section>
  );
};
