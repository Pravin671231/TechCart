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
