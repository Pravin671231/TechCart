import crypto from "node:crypto";
import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M6 / Issue #165 — client-side payment verification, real DB. Order
// creation (POST .../payment) mocks the Razorpay SDK's own network call;
// verification itself is exercised for real by self-computing an HMAC with
// the same dummy RAZORPAY_KEY_SECRET vitest.config.ts injects — proving the
// full verify -> markOrderPaid path without needing real credentials.
//
// This is a full mock, not a partial importOriginal() one: importOriginal()
// forces eager evaluation of the real module (and transitively
// @/config/env) the moment anything in this file statically imports from
// "@/externalService/razorpay", which happens before bootstrapMemoryMongo()
// has set the real MONGODB_URI — freezing it on vitest.config.ts's
// placeholder, the exact bug class orders.service.ts's own dynamic-import
// comments document. verifyPaymentSignature is genuinely under test here
// (payments.service.ts imports it from this same module), so the mock
// reimplements its real HMAC logic directly against node:crypto rather than
// importing it — identical algorithm, same dummy secret, zero dependency on
// @/config/env.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/externalService/razorpay", async () => {
  const nodeCrypto = await import("node:crypto");
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
      const expectedBuf = Buffer.from(expected, "hex");
      const actualBuf = Buffer.from(razorpaySignature, "hex");
      if (expectedBuf.length !== actualBuf.length) return false;
      return nodeCrypto.timingSafeEqual(expectedBuf, actualBuf);
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

const BUYER_EMAIL = "payments-verify-buyer@example.com";
const KEY_SECRET = "test-razorpay-key-secret";

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

function signPayment(razorpayOrderId: string, razorpayPaymentId: string): string {
  return crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
}

async function seedOrder(authToken: string): Promise<string> {
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
  await authRequest(app, "post", "/api/cart/items", authToken).send({
    variantId: variantId.toString(),
    quantity: 1,
  });
  const res = await authRequest(app, "post", "/api/orders", authToken).send({
    shippingAddress: validAddress,
  });
  return res.body.data.id as string;
}

async function seedOrderWithPayment(razorpayOrderId: string): Promise<string> {
  const orderId = await seedOrder(token);
  vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
    id: razorpayOrderId,
    amount: 400000000,
    currency: "INR",
    status: "created",
  });
  await authRequest(app, "post", `/api/orders/${orderId}/payment`, token);
  return orderId;
}

function req(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, token);
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

describe("POST /api/orders/:id/payment/verify (FR-PAY-005-011)", () => {
  it("marks the order paid on a genuinely valid signature", async () => {
    const razorpayOrderId = "order_verifyok";
    const orderId = await seedOrderWithPayment(razorpayOrderId);
    const razorpayPaymentId = "pay_verifyok";
    const razorpaySignature = signPayment(razorpayOrderId, razorpayPaymentId);

    const res = await req("post", `/api/orders/${orderId}/payment/verify`).send({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("paid");

    const detail = await req("get", `/api/orders/${orderId}`);
    expect(detail.body.data.status).toBe("paid");
  });

  it("rejects a tampered signature and leaves the order pending_payment", async () => {
    const razorpayOrderId = "order_verifybad";
    const orderId = await seedOrderWithPayment(razorpayOrderId);

    const res = await req("post", `/api/orders/${orderId}/payment/verify`).send({
      razorpayOrderId,
      razorpayPaymentId: "pay_verifybad",
      razorpaySignature: "not-a-real-signature",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PAYMENT_VERIFICATION_FAILED");

    const detail = await req("get", `/api/orders/${orderId}`);
    expect(detail.body.data.status).toBe("pending_payment");
  });

  it("returns PAYMENT_NOT_FOUND for a razorpayOrderId that was never initiated for this order", async () => {
    const orderId = await seedOrder(token);

    const res = await req("post", `/api/orders/${orderId}/payment/verify`).send({
      razorpayOrderId: "order_never_initiated",
      razorpayPaymentId: "pay_x",
      razorpaySignature: signPayment("order_never_initiated", "pay_x"),
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PAYMENT_NOT_FOUND");
  });
});
