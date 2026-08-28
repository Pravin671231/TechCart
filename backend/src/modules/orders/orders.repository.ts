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

// FR-ORD-012, FR-ORD-030's identical pattern — ownership filtered into the
// query itself ({_id, user} together), never fetch-then-check, so a
// non-owned or nonexistent id both resolve to null here.
export async function findOwned(
  id: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<OrderRecord | null> {
  return Order.findOne({ _id: id, user: userId }).lean();
}

// FR-ORD-011 — a buyer's own order history, newest first, paginated. No
// search/sort dimension (unlike the admin list #158 adds) — the SRS
// specifies "newest first" only.
export async function listForUser(
  userId: Types.ObjectId,
  page: { page: number; limit: number },
): Promise<{ items: OrderRecord[]; total: number }> {
  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Order.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(page.limit).lean(),
    Order.countDocuments({ user: userId }),
  ]);
  return { items, total };
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
