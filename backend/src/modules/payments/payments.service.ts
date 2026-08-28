import { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import { env } from "@/config/env";
import {
  createRazorpayOrder,
  verifyPaymentSignature as verifyPaymentSignatureCrypto,
} from "@/externalService/razorpay";
import { findOwned as findOwnedOrder } from "@/modules/orders/orders.repository";
import { buildOrderResponse, markOrderPaid, type OrderResponse } from "@/modules/orders/orders.service";
import {
  create,
  findByRazorpayOrderId,
  findLatestByOrder,
  markCaptured,
  markFailed,
  type PaymentRecord,
} from "./payments.repository";

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
