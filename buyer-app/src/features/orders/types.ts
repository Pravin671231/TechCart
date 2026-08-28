import type { Pagination } from "@/store/api";

// Mirrors backend's OrderResponse/CheckoutResponse (orders.service.ts,
// SRS v0.5 §2.2/§2.4). Ids/dates come through as strings over the wire.
// Canonical home for these types — checkout/types.ts re-exports them rather
// than duplicating, since checkout (#161) and this feature (#162) both
// render the identical order shape.

export type OrderItemView = {
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
};

export type OrderShippingAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

// Matches backend's ORDER_STATUSES (orders.model.ts) exactly, including
// "refunded" — a real gap found while building admin-app's own order
// management (Issue #163): that issue's status-advance control is what
// first makes "refunded" reachable in production (nothing before it wired
// any UI to that transition), so a buyer viewing their history needed to be
// able to render it too, not just the six statuses #162 originally shipped.
export type OrderStatus =
  "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";

export type OrderResponse = {
  id: string;
  orderNumber: string;
  user: string;
  status: OrderStatus;
  items: OrderItemView[];
  shippingAddress: OrderShippingAddress;
  totalAmount: number;
  statusHistory: { status: OrderStatus; at: string; note?: string }[];
  trackingReference?: string;
  cancellationReason?: string;
  createdAt: string;
};

export type DroppedItem = { sku: string; reason: string };

// FR-ORD-025 — present only when at least one cart line was dropped as
// unavailable at commit time; absent (not an empty array) otherwise,
// matching the backend's own conditional-spread convention.
export type CheckoutResponse = OrderResponse & {
  droppedItems?: DroppedItem[];
};

export type GetOrdersResult = { items: OrderResponse[]; pagination: Pagination };

// FR-ORD-014 — cancellation is only ever legal from these two statuses; the
// state machine (backend) is the real enforcement, this only drives whether
// the cancel button renders at all.
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = ["pending_payment", "paid"];
