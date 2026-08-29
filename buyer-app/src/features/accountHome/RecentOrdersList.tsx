import Link from "next/link";
import { OrderRow } from "@/features/orders/OrderRow";
import type { OrderResponse } from "@/features/orders/types";

// Issue #175/M7.5 — 5 most recent orders, each linking to the existing
// order-detail route from M5 (OrderRow, reused verbatim) rather than a
// duplicated summary view. A brand-new buyer with no orders yet gets a
// distinct empty state, not a blank list.
export function RecentOrdersList({ orders }: { orders: OrderResponse[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-6 text-center">
        <p className="text-sm text-gray-600">You haven&apos;t placed any orders yet.</p>
        <Link
          href="/"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
      <div className="text-center">
        <Link href="/orders" className="text-sm font-medium text-primary hover:underline">
          View all orders
        </Link>
      </div>
    </div>
  );
}
