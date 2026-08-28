import type { Types } from "mongoose";
import {
  Order,
  type OrderDocument,
  type OrderItemSnapshot,
  type OrderShippingAddress,
  type OrderStatus,
  type OrderStatusHistoryEntry,
} from "./orders.model";

export type OrderRecord = OrderDocument & { _id: Types.ObjectId };

export type CreateOrderDoc = {
  orderNumber: string;
  user: Types.ObjectId;
  items: OrderItemSnapshot[];
  shippingAddress: OrderShippingAddress;
  totalAmount: number;
  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntry[];
};

export async function create(doc: CreateOrderDoc): Promise<OrderRecord> {
  const order = await Order.create(doc);
  return order.toObject();
}

export async function findById(id: Types.ObjectId): Promise<OrderRecord | null> {
  return Order.findById(id).lean();
}

// FR-ORD-013, FR-ORD-019 — every status write goes through this single
// function: sets `status` and appends one entry to `statusHistory`, in one
// atomic update. orders.service.ts's transitionOrder() is the only caller,
// after orders.stateMachine.ts's assertTransition() has already validated
// the move.
export async function updateStatus(
  id: Types.ObjectId,
  status: OrderStatus,
  historyEntry: OrderStatusHistoryEntry,
  extra?: { trackingReference?: string; cancellationReason?: string },
): Promise<OrderRecord | null> {
  return Order.findByIdAndUpdate(
    id,
    {
      $set: { status, ...extra },
      $push: { statusHistory: historyEntry },
    },
    { new: true },
  ).lean();
}

// FR-ORD-010 — orders left in pending_payment past the 30-minute window,
// for the scheduled auto-cancel sweep (queueWorkers.ts).
export async function findStalePendingPayment(olderThan: Date): Promise<OrderRecord[]> {
  return Order.find({ status: "pending_payment", createdAt: { $lt: olderThan } }).lean();
}
