import type { Types } from "mongoose";
import {
  Payment,
  type PaymentDocument,
  type PaymentRefund,
  type PaymentStatus,
  type PaymentWebhookEvent,
} from "./payments.model";

export type PaymentRecord = PaymentDocument & { _id: Types.ObjectId };

export type CreatePaymentDoc = {
  order: Types.ObjectId;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
};

export async function create(doc: CreatePaymentDoc): Promise<PaymentRecord> {
  const payment = await Payment.create(doc);
  return payment.toObject();
}

// FR-PAY-001 idempotency — the most recent attempt for an order, used to
// decide whether initiatePayment() should reuse an existing Razorpay order
// or mint a fresh one after a prior attempt failed (FR-PAY-011).
export async function findLatestByOrder(orderId: Types.ObjectId): Promise<PaymentRecord | null> {
  return Payment.findOne({ order: orderId }).sort({ createdAt: -1 }).lean();
}

// #168 — batch counterpart of findLatestByOrder, for attaching a payment
// summary to an admin order list page (one query for the whole page rather
// than one per row). Returns every attempt for every requested order,
// newest first; payments.service.ts's getPaymentSummariesByOrders() reduces
// this to one (the latest) per order.
export async function findLatestByOrders(orderIds: Types.ObjectId[]): Promise<PaymentRecord[]> {
  return Payment.find({ order: { $in: orderIds } })
    .sort({ createdAt: -1 })
    .lean();
}

export async function findByRazorpayOrderId(
  razorpayOrderId: string,
): Promise<PaymentRecord | null> {
  return Payment.findOne({ razorpayOrderId }).lean();
}

export async function findById(id: Types.ObjectId): Promise<PaymentRecord | null> {
  return Payment.findById(id).lean();
}

// FR-PAY idempotency — true if this exact webhook event has already been
// recorded on this payment (by id, regardless of order in the array).
export async function hasWebhookEvent(id: Types.ObjectId, eventId: string): Promise<boolean> {
  const match = await Payment.findOne(
    { _id: id, "webhookEvents.eventId": eventId },
    { _id: 1 },
  ).lean();
  return match !== null;
}

export async function markCaptured(
  id: Types.ObjectId,
  fields: { razorpayPaymentId: string; razorpaySignature?: string },
): Promise<PaymentRecord | null> {
  return Payment.findByIdAndUpdate(
    id,
    { $set: { status: "captured", capturedAt: new Date(), ...fields } },
    { new: true },
  ).lean();
}

export async function markFailed(id: Types.ObjectId): Promise<PaymentRecord | null> {
  return Payment.findByIdAndUpdate(id, { $set: { status: "failed" } }, { new: true }).lean();
}

export async function appendWebhookEvent(
  id: Types.ObjectId,
  event: PaymentWebhookEvent,
): Promise<PaymentRecord | null> {
  return Payment.findByIdAndUpdate(id, { $push: { webhookEvents: event } }, { new: true }).lean();
}

export async function addRefund(
  id: Types.ObjectId,
  refund: PaymentRefund,
  status: PaymentStatus,
): Promise<PaymentRecord | null> {
  return Payment.findByIdAndUpdate(
    id,
    { $push: { refunds: refund }, $set: { status } },
    { new: true },
  ).lean();
}

// Issue #171/M7.1 (FR-DASH-001/003/004) — captured payment amounts (paise)
// within a date range, keyed by capturedAt (not createdAt/updatedAt — see
// payments.model.ts's own comment on why). Includes payments that have since
// been partially/fully refunded, since the capture itself still happened;
// sumRefundsInRange below is what nets the refunded portion back out.
export async function sumCapturedInRange(from: Date, to: Date): Promise<number> {
  const [result] = await Payment.aggregate<{ total: number }>([
    {
      $match: {
        capturedAt: { $gte: from, $lte: to },
        status: { $in: ["captured", "partially_refunded", "refunded"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return result?.total ?? 0;
}

// Issue #171/M7.1 (FR-DASH-003) — refund amounts (paise) actually processed
// within a date range, keyed by each refund's own createdAt (each refund
// already carries its own precise timestamp — refunds.service.ts).
export async function sumRefundsInRange(from: Date, to: Date): Promise<number> {
  const [result] = await Payment.aggregate<{ total: number }>([
    { $unwind: "$refunds" },
    { $match: { "refunds.createdAt": { $gte: from, $lte: to } } },
    { $group: { _id: null, total: { $sum: "$refunds.amount" } } },
  ]);
  return result?.total ?? 0;
}

// Issue #173/M7.3 — a buyer's lifetime refund total (paise), unscoped by
// date, used to net lifetimeAmountSpent for the buyer account dashboard.
export async function sumRefundsForOrders(orderIds: Types.ObjectId[]): Promise<number> {
  if (orderIds.length === 0) return 0;
  const [result] = await Payment.aggregate<{ total: number }>([
    { $match: { order: { $in: orderIds } } },
    { $unwind: "$refunds" },
    { $group: { _id: null, total: { $sum: "$refunds.amount" } } },
  ]);
  return result?.total ?? 0;
}
