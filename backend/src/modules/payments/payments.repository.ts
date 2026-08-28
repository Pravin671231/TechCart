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
    { $set: { status: "captured", ...fields } },
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
