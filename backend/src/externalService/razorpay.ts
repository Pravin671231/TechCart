import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "@/config/env";

// The third external-service client under externalService/, after r2.ts and
// mailer.ts — same shape: one client built at module load from env vars,
// plain exported async functions wrapping its network calls. The two
// signature-verification functions below are pure crypto (no network) and
// are exercised for real in tests against the dummy RAZORPAY_KEY_SECRET/
// RAZORPAY_WEBHOOK_SECRET test env values; createRazorpayOrder/
// createRazorpayRefund are mocked wholesale in every test, same convention
// as r2.ts's actual upload calls.
const client = new Razorpay({
  key_id: env.RAZORPAY.KEY_ID,
  key_secret: env.RAZORPAY.KEY_SECRET,
});

export type RazorpayOrderResult = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

export async function createRazorpayOrder(
  amountPaise: number,
  currency: string,
  receipt: string,
): Promise<RazorpayOrderResult> {
  const order = await client.orders.create({ amount: amountPaise, currency, receipt });
  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
    status: order.status,
  };
}

export type RazorpayRefundResult = {
  id: string;
  amount: number;
  status: string;
};

export async function createRazorpayRefund(
  paymentId: string,
  amountPaise: number,
): Promise<RazorpayRefundResult> {
  const refund = await client.payments.refund(paymentId, { amount: amountPaise });
  return {
    id: refund.id,
    amount: refund.amount ?? amountPaise,
    status: refund.status,
  };
}

// FR-PAY-006 — verifies the Razorpay Checkout widget's client-side success
// callback. Razorpay's documented algorithm: HMAC-SHA256 of
// "{orderId}|{paymentId}", keyed by the account's key_secret (the same
// secret used to authenticate API calls — distinct from the webhook secret
// below). Implemented directly against Node's crypto rather than the SDK's
// own validatePaymentVerification helper, which lives at an unexported
// subpath (razorpay/dist/utils/razorpay-utils) not part of the package's
// public API surface.
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY.KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return timingSafeEqualHex(expected, razorpaySignature);
}

// FR-PAY-023 — verifies a webhook delivery's signature against the exact
// raw (unparsed) request body bytes, keyed by the webhook secret configured
// separately in the Razorpay Dashboard when the webhook URL is registered
// (deliberately a different secret than key_secret above). Uses the SDK's
// own public static helper, which wraps the identical HMAC-SHA256 algorithm.
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  return Razorpay.validateWebhookSignature(rawBody, signature, env.RAZORPAY.WEBHOOK_SECRET);
}

function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}
