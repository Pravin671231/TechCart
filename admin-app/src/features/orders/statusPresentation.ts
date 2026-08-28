import type { OrderStatus } from "./types";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const STATUS_TONE: Record<OrderStatus, "success" | "neutral" | "warning"> = {
  pending_payment: "neutral",
  paid: "success",
  processing: "success",
  shipped: "success",
  delivered: "success",
  cancelled: "warning",
  refunded: "warning",
};
