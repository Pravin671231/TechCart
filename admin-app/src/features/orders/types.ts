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

// Mirrors backend's payments.model.ts's PAYMENT_STATUSES exactly.
export const PAYMENT_STATUSES = [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Mirrors backend's payments.service.ts's PaymentSummary — a lightweight
// projection attached to both the admin order list and detail responses
// (Issue #168), null when no payment attempt has ever been made for the
// order yet. `amount` is integer paise, unlike every other money field on
// AdminOrder (totalAmount, item prices), which are whole rupees — this
// module converts at its own boundary (RefundOrderModal), not here.
export interface PaymentSummary {
  status: PaymentStatus;
  amount: number;
  razorpayPaymentId?: string;
}

// The two fields beyond buyer-app's own OrderResponse shape — the ordering
// buyer's resolved identity (backend's getOrderForAdmin/listOrdersForAdmin
// both populate it; null only if the buyer account itself was hard-deleted,
// which nothing in this codebase does today) and the payment summary
// (Issue #168/#170).
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
  payment: PaymentSummary | null;
}

// Matches backend's ORDER_SORT_FIELDS (orders.repository.ts). Kept as one
// combined string at the UI layer, same convention as products/types.ts's
// ProductSort — ordersApi.ts's getOrders splits it into ?sortBy=/?orderBy=
// when building the request.
export type OrderSort = "-createdAt" | "createdAt" | "-totalAmount" | "totalAmount";
