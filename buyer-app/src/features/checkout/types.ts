// Mirrors backend's OrderResponse/CheckoutResponse (orders.service.ts,
// SRS v0.5 §2.2). Ids/dates come through as strings over the wire.

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

export type OrderStatus =
  "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";

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
