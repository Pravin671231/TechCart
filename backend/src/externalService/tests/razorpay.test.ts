import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaymentSignature, verifyWebhookSignature } from "../razorpay";

// FR-PAY-006, FR-PAY-023 — both functions are pure crypto (no network), so
// they're exercised for real here by self-computing an HMAC against the
// dummy RAZORPAY_KEY_SECRET/RAZORPAY_WEBHOOK_SECRET vitest.config.ts injects
// — proving the verification logic is genuinely correct without needing
// real Razorpay credentials.
const KEY_SECRET = "test-razorpay-key-secret";
const WEBHOOK_SECRET = "test-razorpay-webhook-secret";

describe("verifyPaymentSignature / FR-PAY-006", () => {
  it("accepts a signature computed the way Razorpay documents", () => {
    const orderId = "order_abc123";
    const paymentId = "pay_xyz789";
    const signature = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(verifyPaymentSignature(orderId, paymentId, signature)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const orderId = "order_abc123";
    const paymentId = "pay_xyz789";
    const validSignature = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    const tampered = `${validSignature.slice(0, -1)}${validSignature.at(-1) === "0" ? "1" : "0"}`;

    expect(verifyPaymentSignature(orderId, paymentId, tampered)).toBe(false);
  });

  it("rejects a signature for a different payment id", () => {
    const orderId = "order_abc123";
    const signature = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(`${orderId}|pay_original`)
      .digest("hex");

    expect(verifyPaymentSignature(orderId, "pay_swapped", signature)).toBe(false);
  });
});

describe("verifyWebhookSignature / FR-PAY-023", () => {
  it("accepts a signature computed over the exact raw body", () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");

    expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("rejects a signature computed over a different body", () => {
    const signedBody = JSON.stringify({ event: "payment.captured" });
    const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(signedBody).digest("hex");
    const actualBody = JSON.stringify({ event: "payment.failed" });

    expect(verifyWebhookSignature(actualBody, signature)).toBe(false);
  });
});
