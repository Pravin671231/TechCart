import { Schema, model, type Types } from "mongoose";

// FR-PAY-001-028 — one document per Razorpay order-attempt against a given
// TechCart order. A retry after a failed attempt (FR-PAY-011) creates a new
// document rather than mutating the failed one, so payments is an append-
// only attempt log, not a single mutable "the payment for this order" row.
export const PAYMENT_STATUSES = [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentRefund = {
  razorpayRefundId: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: Date;
};

// FR-PAY idempotency — one entry per processed webhook event id, so a
// redelivered event is recognized and skipped rather than reprocessed.
export type PaymentWebhookEvent = {
  eventId: string;
  type: string;
  receivedAt: Date;
};

export type PaymentDocument = {
  order: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  // FR-PAY-026 — integer paise, not rupees. orders.totalAmount is a plain
  // rupee number; the conversion happens once, at initiatePayment().
  amount: number;
  currency: string;
  status: PaymentStatus;
  refunds: PaymentRefund[];
  webhookEvents: PaymentWebhookEvent[];
  // Issue #171/M7.1 (FR-DASH-003) — the moment this payment actually
  // transitioned to captured, set once inside markCaptured() and never
  // touched again. Distinct from `updatedAt`, which a later refund's own
  // $set re-bumps (addRefund) — capturedAt stays accurate for date-range-
  // scoped revenue reporting even after a payment has since been refunded.
  capturedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const paymentRefundSchema = new Schema<PaymentRefund>(
  {
    razorpayRefundId: { type: String, required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const paymentWebhookEventSchema = new Schema<PaymentWebhookEvent>(
  {
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    receivedAt: { type: Date, required: true },
  },
  { _id: false },
);

const paymentSchema = new Schema<PaymentDocument>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR" },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: "created" },
    refunds: { type: [paymentRefundSchema], required: true, default: [] },
    webhookEvents: { type: [paymentWebhookEventSchema], required: true, default: [] },
    capturedAt: { type: Date },
  },
  { timestamps: true },
);

// FR-PAY idempotency — a webhook event id must never be recorded twice
// across the whole collection, not just within one document; a unique
// sparse multikey index on webhookEvents.eventId enforces that even under
// concurrent delivery, alongside the in-code check in payments.service.ts.
paymentSchema.index({ "webhookEvents.eventId": 1 }, { unique: true, sparse: true });

export const Payment = model<PaymentDocument>("Payment", paymentSchema);
