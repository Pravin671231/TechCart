import { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import { env } from "@/config/env";
import {
  createRazorpayOrder,
  createRazorpayRefund,
  verifyPaymentSignature as verifyPaymentSignatureCrypto,
  verifyWebhookSignature as verifyWebhookSignatureCrypto,
} from "@/externalService/razorpay";
import { findOwned as findOwnedOrder } from "@/modules/orders/orders.repository";
import {
  buildOrderResponse,
  getOrderForAdmin,
  markOrderPaid,
  transitionOrder,
  type AdminOrderResponse,
  type OrderResponse,
} from "@/modules/orders/orders.service";
import {
  addRefund,
  appendWebhookEvent,
  create,
  findByRazorpayOrderId,
  findLatestByOrder,
  hasWebhookEvent,
  markCaptured,
  markFailed,
  type PaymentRecord,
} from "./payments.repository";
import type { PaymentStatus } from "./payments.model";

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export type InitiatePaymentResponse = {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

function toInitiateResponse(payment: PaymentRecord): InitiatePaymentResponse {
  return {
    razorpayOrderId: payment.razorpayOrderId,
    amount: payment.amount,
    currency: payment.currency,
    keyId: env.RAZORPAY.KEY_ID,
  };
}

// FR-PAY-001-004 — mints a Razorpay order for an owned, pending_payment
// order. Idempotent: a re-call while the latest attempt is still "created"
// (or already captured/refunded — see the status guard below) returns that
// same attempt rather than minting a second Razorpay order; a re-call after
// the latest attempt "failed" mints a fresh one (FR-PAY-011's retry path,
// formalized/audited by #168 — already reachable here since the guard below
// only blocks a non-failed existing attempt).
export async function initiatePayment(
  userId: string,
  orderId: string,
): Promise<InitiatePaymentResponse> {
  const orderOid = toObjectId(orderId);
  const order = await findOwnedOrder(orderOid, toObjectId(userId));
  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  }
  if (order.status !== "pending_payment") {
    throw new AppError(
      400,
      "PAYMENT_NOT_ALLOWED",
      `Cannot initiate payment for an order with status '${order.status}'.`,
    );
  }

  const existing = await findLatestByOrder(orderOid);
  if (existing && existing.status !== "failed") {
    return toInitiateResponse(existing);
  }

  // FR-PAY-026 — orders.totalAmount is a plain rupee number; this is the
  // single point where it's converted to integer paise for Razorpay/this
  // module's own storage.
  const amountPaise = Math.round(order.totalAmount * 100);
  const razorpayOrder = await createRazorpayOrder(amountPaise, "INR", order.orderNumber);

  const payment = await create({
    order: orderOid,
    razorpayOrderId: razorpayOrder.id,
    amount: amountPaise,
    currency: "INR",
    status: "created",
  });

  return toInitiateResponse(payment);
}

export type VerifyPaymentInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

// FR-PAY-005-011 — the Razorpay Checkout widget's client-side success
// callback, verified server-side before the order is ever marked paid. A
// signature mismatch fails this attempt but leaves the order itself in
// pending_payment, so the buyer can retry (FR-PAY-011, initiatePayment's own
// idempotency guard above already mints a fresh Razorpay order once this
// attempt is marked failed).
export async function verifyPayment(
  userId: string,
  orderId: string,
  input: VerifyPaymentInput,
): Promise<OrderResponse> {
  const orderOid = toObjectId(orderId);
  const order = await findOwnedOrder(orderOid, toObjectId(userId));
  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  }

  const payment = await findByRazorpayOrderId(input.razorpayOrderId);
  if (!payment || payment.order.toString() !== orderId) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "No matching payment attempt for this order.");
  }

  const isValid = verifyPaymentSignatureCrypto(
    input.razorpayOrderId,
    input.razorpayPaymentId,
    input.razorpaySignature,
  );

  if (!isValid) {
    await markFailed(payment._id);
    throw new AppError(
      400,
      "PAYMENT_VERIFICATION_FAILED",
      "Payment signature verification failed.",
    );
  }

  await markCaptured(payment._id, {
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
  });
  const updatedOrder = await markOrderPaid(orderOid, input.razorpayPaymentId);
  return buildOrderResponse(updatedOrder);
}

type RazorpayWebhookEntity = {
  id: string;
  order_id?: string;
};

type RazorpayWebhookBody = {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayWebhookEntity };
  };
};

function resolveEventId(
  headerEventId: string | undefined,
  body: RazorpayWebhookBody,
  paymentEntity: RazorpayWebhookEntity | undefined,
): string {
  if (headerEventId) return headerEventId;
  // No x-razorpay-event-id header present — fall back to a deterministic
  // key from the event type + payment id, so a redelivery of the identical
  // event still collapses to the same idempotency key.
  return `${body.event}:${paymentEntity?.id ?? "unknown"}`;
}

// FR-PAY-023-025 — the source of truth for payment state: verifies the raw
// body's signature, then handles payment.captured/payment.failed
// idempotently (a redelivered event id is recognized and skipped, never
// reprocessed). Silently no-ops (still succeeds, so Razorpay doesn't retry)
// on an event this backend has no matching payment record for, or one whose
// payload doesn't carry a payment entity at all.
export async function handleRazorpayWebhookEvent(
  rawBody: string,
  signature: string | undefined,
  headerEventId: string | undefined,
): Promise<void> {
  if (!signature) {
    throw new AppError(400, "MISSING_WEBHOOK_SIGNATURE", "Missing webhook signature header.");
  }
  if (!verifyWebhookSignatureCrypto(rawBody, signature)) {
    throw new AppError(400, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature verification failed.");
  }

  const body = JSON.parse(rawBody) as RazorpayWebhookBody;
  const paymentEntity = body.payload?.payment?.entity;
  if (!paymentEntity?.order_id) {
    return;
  }

  const payment = await findByRazorpayOrderId(paymentEntity.order_id);
  if (!payment) {
    return;
  }

  const eventId = resolveEventId(headerEventId, body, paymentEntity);
  if (await hasWebhookEvent(payment._id, eventId)) {
    return;
  }

  if (body.event === "payment.captured") {
    if (payment.status !== "captured") {
      await markCaptured(payment._id, { razorpayPaymentId: paymentEntity.id });
      await markOrderPaid(payment.order, paymentEntity.id);
    }
  } else if (body.event === "payment.failed") {
    if (payment.status === "created") {
      await markFailed(payment._id);
    }
  }

  await appendWebhookEvent(payment._id, {
    eventId,
    type: body.event,
    receivedAt: new Date(),
  });
}

export type RefundInput = {
  amount?: number | undefined;
  reason: string;
};

// FR-PAY-012-018 — full or partial refund, admin-initiated. A full refund
// (the requested amount, or the whole remaining balance when amount is
// omitted, exhausts what's left) also transitions the order itself to
// "refunded" via the shared transitionOrder() (the state machine already
// has every paid/processing/shipped/delivered -> refunded edge, no change
// needed there); a partial refund leaves the order's own status untouched —
// there is no "partially refunded" order status in the state machine.
export async function refundOrder(
  orderId: string,
  input: RefundInput,
): Promise<AdminOrderResponse> {
  const orderOid = toObjectId(orderId);
  const payment = await findLatestByOrder(orderOid);
  if (!payment || (payment.status !== "captured" && payment.status !== "partially_refunded")) {
    throw new AppError(
      400,
      "REFUND_NOT_ALLOWED",
      "This order has no captured payment eligible for refund.",
    );
  }
  if (!payment.razorpayPaymentId) {
    throw new AppError(
      400,
      "REFUND_NOT_ALLOWED",
      "This order has no captured payment eligible for refund.",
    );
  }

  const alreadyRefunded = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
  const refundable = payment.amount - alreadyRefunded;
  const amount = input.amount ?? refundable;

  if (amount <= 0 || amount > refundable) {
    throw new AppError(
      400,
      "REFUND_AMOUNT_INVALID",
      `Refund amount must be between 1 and ${refundable} paise.`,
    );
  }

  const result = await createRazorpayRefund(payment.razorpayPaymentId, amount);
  const isFullRefund = alreadyRefunded + amount >= payment.amount;
  const newStatus: PaymentStatus = isFullRefund ? "refunded" : "partially_refunded";

  await addRefund(
    payment._id,
    {
      razorpayRefundId: result.id,
      amount,
      reason: input.reason,
      status: result.status,
      createdAt: new Date(),
    },
    newStatus,
  );

  if (isFullRefund) {
    await transitionOrder(orderOid, "refunded", { note: input.reason });
  }

  return getOrderForAdmin(orderId);
}
