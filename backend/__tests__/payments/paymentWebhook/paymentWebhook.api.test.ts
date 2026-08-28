import crypto from "node:crypto";
import { Types } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M6 / Issue #166 — the webhook is the source of truth: real DB, and the
// signature is verified for real against the dummy RAZORPAY_WEBHOOK_SECRET
// vitest.config.ts injects (a self-computed HMAC, same "exercise the pure
// crypto for real" convention as #165's verify suite). Order/payment
// creation still mocks the Razorpay SDK's own network call.
//
// This is a full mock, not a partial importOriginal() one: importOriginal()
// forces eager evaluation of the real module (and transitively
// @/config/env) the moment anything in this file statically imports from
// "@/externalService/razorpay", which happens before bootstrapMemoryMongo()
// has set the real MONGODB_URI — freezing it on vitest.config.ts's
// placeholder, the exact bug class orders.service.ts's own dynamic-import
// comments document. verifyPaymentSignature/verifyWebhookSignature are
// genuinely under test here (payments.service.ts imports both from this
// same module), so the mock reimplements their real HMAC logic directly
// against node:crypto rather than importing them — identical algorithm,
// same dummy secrets, zero dependency on @/config/env.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/externalService/razorpay", async () => {
  const nodeCrypto = await import("node:crypto");
  function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = Buffer.from(actualHex, "hex");
    if (expected.length !== actual.length) return false;
    return nodeCrypto.timingSafeEqual(expected, actual);
  }
  return {
    createRazorpayOrder: vi.fn(),
    verifyPaymentSignature: (
      razorpayOrderId: string,
      razorpayPaymentId: string,
      razorpaySignature: string,
    ): boolean => {
      const expected = nodeCrypto
        .createHmac("sha256", "test-razorpay-key-secret")
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");
      return timingSafeEqualHex(expected, razorpaySignature);
    },
    verifyWebhookSignature: (rawBody: string, signature: string): boolean => {
      const expected = nodeCrypto
        .createHmac("sha256", "test-razorpay-webhook-secret")
        .update(rawBody)
        .digest("hex");
      return timingSafeEqualHex(expected, signature);
    },
  };
});

import { createRazorpayOrder } from "@/externalService/razorpay";
import { Product } from "@/modules/product-catalog/features/products/products.model";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const BUYER_EMAIL = "payments-webhook-buyer@example.com";
const WEBHOOK_SECRET = "test-razorpay-webhook-secret";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;

const validAddress = {
  fullName: "Asha Rao",
  phone: "9876543210",
  line1: "221B, Residency Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560025",
};

function signWebhook(rawBody: string): string {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
}

async function seedOrderWithPayment(razorpayOrderId: string): Promise<string> {
  const product = await Product.create({
    name: "Nova X5 Pro 5G",
    slug: `nova-${new Types.ObjectId().toString()}`,
    description: "A phone.",
    brand: new Types.ObjectId(),
    category: new Types.ObjectId(),
    specifications: [],
    isFeatured: false,
    status: "published",
    variants: [
      {
        sku: `SKU-${new Types.ObjectId().toString()}`,
        attributes: [{ name: "Color", value: "Black" }],
        images: [{ url: "https://cdn.test/a.webp", alt: "A", isPrimary: true }],
        mrp: 5000000,
        discount: 20,
        sellingPrice: 4000000,
        active: true,
      },
    ],
  });
  const variantId = product.variants[0]!._id;
  await authRequest(app, "post", "/api/cart/items", token).send({
    variantId: variantId.toString(),
    quantity: 1,
  });
  const res = await authRequest(app, "post", "/api/orders", token).send({
    shippingAddress: validAddress,
  });
  const orderId = res.body.data.id as string;

  vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
    id: razorpayOrderId,
    amount: 400000000,
    currency: "INR",
    status: "created",
  });
  await authRequest(app, "post", `/api/orders/${orderId}/payment`, token);

  return orderId;
}

function postWebhook(rawBody: string, signature: string | undefined, eventId?: string) {
  const req = request(app)
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json");
  if (signature !== undefined) req.set("x-razorpay-signature", signature);
  if (eventId !== undefined) req.set("x-razorpay-event-id", eventId);
  return req.send(rawBody);
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;
  token = await signInBuyer(app, BUYER_EMAIL);
}, 90000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

beforeEach(async () => {
  await ctx.mongoose.connection.db!.collection("carts").deleteMany({});
  await ctx.mongoose.connection.db!.collection("products").deleteMany({});
  await ctx.mongoose.connection.db!.collection("addresses").deleteMany({});
  await ctx.mongoose.connection.db!.collection("orders").deleteMany({});
  await ctx.mongoose.connection.db!.collection("counters").deleteMany({});
  await ctx.mongoose.connection.db!.collection("payments").deleteMany({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/webhooks/razorpay (FR-PAY-023-025)", () => {
  it("rejects a missing signature header", async () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });

    const res = await postWebhook(rawBody, undefined);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_WEBHOOK_SIGNATURE");
  });

  it("rejects a signature that doesn't match the raw body", async () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });

    const res = await postWebhook(rawBody, "not-a-real-signature");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_WEBHOOK_SIGNATURE");
  });

  it("marks the order paid on a genuinely signed payment.captured event", async () => {
    const razorpayOrderId = "order_webhook_captured";
    const orderId = await seedOrderWithPayment(razorpayOrderId);
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_webhook1", order_id: razorpayOrderId } } },
    });

    const res = await postWebhook(rawBody, signWebhook(rawBody), "evt_captured_1");

    expect(res.status).toBe(200);

    const detail = await authRequest(app, "get", `/api/orders/${orderId}`, token);
    expect(detail.body.data.status).toBe("paid");
  });

  it("is idempotent — a redelivered event id doesn't reprocess or error", async () => {
    const razorpayOrderId = "order_webhook_dupe";
    const orderId = await seedOrderWithPayment(razorpayOrderId);
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_webhook2", order_id: razorpayOrderId } } },
    });
    const signature = signWebhook(rawBody);

    const first = await postWebhook(rawBody, signature, "evt_dupe_1");
    const second = await postWebhook(rawBody, signature, "evt_dupe_1");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const detail = await authRequest(app, "get", `/api/orders/${orderId}`, token);
    expect(detail.body.data.statusHistory).toHaveLength(2); // pending_payment, paid — not paid twice
    expect(detail.body.data.status).toBe("paid");
  });

  it("acknowledges (200) an event for an order_id it has no matching payment for", async () => {
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_unknown", order_id: "order_never_seen" } } },
    });

    const res = await postWebhook(rawBody, signWebhook(rawBody), "evt_unknown_1");

    expect(res.status).toBe(200);
  });
});
