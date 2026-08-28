import { Types } from "mongoose";
import type { JobsOptions } from "bullmq";
import { orderNotificationsQueue } from "@/lib/queue";
import {
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  type OrderNotifiableStatus,
} from "@/externalService/mailer";
import { findBuyerIdentity, findById, type OrderRecord } from "./orders.repository";
import type { OrderStatus } from "./orders.model";

// FR-ORD-022 — exactly these four transitions get a notification email;
// every other status change (e.g. pending_payment -> paid is covered by
// "paid" itself; processing has none per the SRS) is silently skipped.
const NOTIFIABLE_STATUSES: readonly OrderStatus[] = ["paid", "shipped", "delivered", "cancelled"];

function isNotifiableStatus(status: OrderStatus): status is OrderNotifiableStatus {
  return (NOTIFIABLE_STATUSES as readonly string[]).includes(status);
}

export const NOTIFICATION_JOB_NAMES = {
  CONFIRMATION: "order-confirmation",
  STATUS: "order-status",
} as const;

type OrderConfirmationJobData = { orderId: string };
type OrderStatusNotificationJobData = { orderId: string; status: OrderNotifiableStatus };

// FR-ORD-023 — BullMQ's own retry policy, not a caller-side retry loop.
const RETRY_OPTS: JobsOptions = { attempts: 3, backoff: { type: "exponential", delay: 5000 } };

// FR-ORD-021 — enqueued at the end of a successful checkout, never awaited
// for its outcome by the caller. Enqueue failures (e.g. Redis unreachable
// mid-request) are caught and logged here, not propagated — checkout's own
// success must never depend on the notification subsystem.
export async function enqueueOrderConfirmation(order: OrderRecord): Promise<void> {
  if (!orderNotificationsQueue) return;
  try {
    const data: OrderConfirmationJobData = { orderId: order._id.toString() };
    await orderNotificationsQueue.add(NOTIFICATION_JOB_NAMES.CONFIRMATION, data, RETRY_OPTS);
  } catch (error) {
    console.warn("[orders] failed to enqueue order-confirmation job", error);
  }
}

// FR-ORD-022 — called from transitionOrder() itself, so every future caller
// (auto-cancel sweep, admin advance/cancel, buyer cancel) gets notification
// coverage for free with no per-call-site duplication.
export async function enqueueStatusNotification(
  order: OrderRecord,
  status: OrderStatus,
): Promise<void> {
  if (!orderNotificationsQueue || !isNotifiableStatus(status)) return;
  try {
    const data: OrderStatusNotificationJobData = { orderId: order._id.toString(), status };
    await orderNotificationsQueue.add(NOTIFICATION_JOB_NAMES.STATUS, data, RETRY_OPTS);
  } catch (error) {
    console.warn("[orders] failed to enqueue order-status job", error);
  }
}

// Worker processors — registered by lib/queueWorkers.ts, dispatched by job
// name. Both silently no-op when the order/buyer no longer resolves (rare:
// only reachable if an order were hard-deleted, which nothing in this
// codebase does) rather than throwing into BullMQ's retry loop forever.
export async function processOrderConfirmationJob(data: OrderConfirmationJobData): Promise<void> {
  const order = await findById(new Types.ObjectId(data.orderId));
  if (!order) return;
  const buyer = await findBuyerIdentity(order.user);
  if (!buyer) return;

  await sendOrderConfirmationEmail(buyer.email, {
    orderNumber: order.orderNumber,
    items: order.items.map((item) => ({
      sku: item.variant.sku,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    totalAmount: order.totalAmount,
    shippingAddress: order.shippingAddress,
  });
}

export async function processOrderStatusJob(data: OrderStatusNotificationJobData): Promise<void> {
  const order = await findById(new Types.ObjectId(data.orderId));
  if (!order) return;
  const buyer = await findBuyerIdentity(order.user);
  if (!buyer) return;

  await sendOrderStatusEmail(buyer.email, order.orderNumber, data.status);
}
