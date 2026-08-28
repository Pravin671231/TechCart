import { AppError } from "@/utils/AppError";
import type { OrderStatus } from "./orders.model";

// FR-ORD-008 — the fixed status lifecycle:
//   pending_payment -> paid -> processing -> shipped -> delivered
// cancelled is reachable only from pending_payment or paid; refunded only
// from paid or later (paid, processing, shipped, delivered). Every write to
// order.status anywhere in this codebase (checkout's initial
// pending_payment aside, which isn't a *transition*) goes through
// assertTransition via orders.service.ts's shared transitionOrder().
const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      409,
      "INVALID_ORDER_TRANSITION",
      `Cannot move an order from '${from}' to '${to}'.`,
    );
  }
}
