import type { OrderStatus } from "./types";

// Client-side mirror of backend's orders.stateMachine.ts ORDER_TRANSITIONS
// (FR-ORD-008) — UX guidance only, driving which options the status-advance
// <select> offers. The backend's assertTransition (called from every write
// through transitionOrder) is the real enforcement — same "mirrors the
// backend's own rule, not shared code" caveat every prior admin form in
// this codebase already carries (CategoryForm's parent picker, the
// type-dependent specification/variant-axis inputs).
//
// "refunded" is deliberately dropped from every status's list here (Issue
// #170/M6.7) — it's still a legal backend transition (paid/processing/
// shipped/delivered -> refunded), but reaching it through this generic
// status <select> would bypass the real refund flow entirely (no Razorpay
// refund call, no payments.refunds[] entry, no refundable-balance check).
// The dedicated Refund action (RefundOrderModal, OrderDetailPage) is now
// the only path to this status.
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

// FR-ORD-015 — admin cancellation is gated by the identical state-machine
// path buyer cancellation uses (transitionOrder -> assertTransition), so
// "cancellable" is exactly "cancelled is a legal next state from here."
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = ["pending_payment", "paid"];
