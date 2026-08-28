import type { OrderStatus } from "./types";

// Client-side mirror of backend's orders.stateMachine.ts ORDER_TRANSITIONS
// (FR-ORD-008) — UX guidance only, driving which options the status-advance
// <select> offers. The backend's assertTransition (called from every write
// through transitionOrder) is the real enforcement — same "mirrors the
// backend's own rule, not shared code" caveat every prior admin form in
// this codebase already carries (CategoryForm's parent picker, the
// type-dependent specification/variant-axis inputs).
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

// FR-ORD-015 — admin cancellation is gated by the identical state-machine
// path buyer cancellation uses (transitionOrder -> assertTransition), so
// "cancellable" is exactly "cancelled is a legal next state from here."
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = ["pending_payment", "paid"];
