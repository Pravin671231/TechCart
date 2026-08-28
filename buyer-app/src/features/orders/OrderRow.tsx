import Link from "next/link";
import { formatPrice } from "@/features/products/money";
import { OrderStatusBadge } from "./OrderStatusBadge";
import type { OrderResponse } from "./types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function OrderRow({ order }: { order: OrderResponse }) {
  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4 hover:border-primary-300"
    >
      <div>
        <p className="text-sm font-medium text-neutral-900">Order #{order.orderNumber}</p>
        <p className="text-xs text-neutral-500">{formatDate(order.createdAt)}</p>
      </div>
      <OrderStatusBadge status={order.status} />
      <p className="text-sm font-semibold text-neutral-900">{formatPrice(order.totalAmount)}</p>
    </Link>
  );
}
