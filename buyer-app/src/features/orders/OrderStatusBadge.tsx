import type { OrderStatus } from "./types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pending",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  paid: "bg-primary-100 text-primary-700",
  processing: "bg-primary-100 text-primary-700",
  shipped: "bg-accent-100 text-accent-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-red-100 text-red-700",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
