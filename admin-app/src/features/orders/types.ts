// Mirrors backend's AdminOrderResponse (orders.service.ts, SRS v0.5 §2.5) —
// ids/dates arrive as strings over the wire. ORDER_STATUSES matches
// orders.model.ts's own const exactly, including "refunded" (reachable via
// this issue's own status-advance control, even though nothing else in the
// codebase surfaces it yet — payments/refunds are v0.6).
export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItemView {
  product: { id: string; name: string; slug: string };
  variant: {
    id: string;
    sku: string;
    attributes: { name: string; value: string }[];
    image: { url: string; alt?: string } | null;
  };
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  at: string;
  note?: string;
}

// The one field beyond buyer-app's own OrderResponse shape — the ordering
// buyer's resolved identity (backend's getOrderForAdmin/listOrdersForAdmin
// both populate it; null only if the buyer account itself was hard-deleted,
// which nothing in this codebase does today).
export interface AdminOrder {
  id: string;
  orderNumber: string;
  user: string;
  status: OrderStatus;
  items: OrderItemView[];
  shippingAddress: OrderShippingAddress;
  totalAmount: number;
  statusHistory: OrderStatusHistoryEntry[];
  trackingReference?: string;
  cancellationReason?: string;
  createdAt: string;
  buyer: { id: string; name: string; email: string } | null;
}

// Matches backend's ORDER_SORT_FIELDS (orders.repository.ts). Kept as one
// combined string at the UI layer, same convention as products/types.ts's
// ProductSort — ordersApi.ts's getOrders splits it into ?sortBy=/?orderBy=
// when building the request.
export type OrderSort = "-createdAt" | "createdAt" | "-totalAmount" | "totalAmount";
