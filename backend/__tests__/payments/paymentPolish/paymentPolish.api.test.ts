import crypto from "node:crypto";
import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M6 / Issue #168 — retry-after-failure, the payment summary now attached
// to buyer/admin order reads, and an error-envelope audit across every
// payment/webhook/refund endpoint this milestone added. Real DB, same
// rationale as every other payments suite in this milestone.
//
// This is a full mock, not a partial importOriginal() one: importOriginal()
// forces eager evaluation of the real module (and transitively
// @/config/env) the moment anything in this file statically imports from
// "@/externalService/razorpay", which happens before bootstrapMemoryMongo()
// has set the real MONGODB_URI — freezing it on vitest.config.ts's
// placeholder, the exact bug class orders.service.ts's own dynamic-import
// comments document. verifyPaymentSignature is genuinely under test here
// (payments.service.ts imports it from this same module, and this suite
// reaches a captured payment via the real initiate -> verify path), so the
// mock reimplements its real HMAC logic directly against node:crypto rather
// than importing it — identical algorithm, same dummy secret, zero
// dependency on @/config/env.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/externalService/razorpay", async () => {
  const nodeCrypto = await import("node:crypto");
  return {
    createRazorpayOrder: vi.fn(),
    createRazorpayRefund: vi.fn(),
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
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const BUYER_EMAIL = "payments-polish-buyer@example.com";
const ORDER_MANAGER_EMAIL = "payments-polish-order-manager@example.com";
const ORDER_MANAGER_PASSWORD = "OrderMgr!Pass1";
const KEY_SECRET = "test-razorpay-key-secret";

let ctx: MemoryMongoContext;
let app: Express;
let buyerToken: string;
let orderManagerToken: string;

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

async function seedOrder(): Promise<string> {
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
  await authRequest(app, "post", "/api/cart/items", buyerToken).send({
    variantId: variantId.toString(),
    quantity: 1,
  });
  const res = await authRequest(app, "post", "/api/orders", buyerToken).send({
    shippingAddress: validAddress,
  });
  return res.body.data.id as string;
}

function assertErrorEnvelope(body: unknown): void {
  expect(body).toMatchObject({ success: false });
  expect(body).toHaveProperty("code", expect.any(String));
  expect(body).toHaveProperty("message", expect.any(String));
  expect(body).not.toHaveProperty("data");
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;
  buyerToken = await signInBuyer(app, BUYER_EMAIL);

  const { provisionAdminUser } = await import("../../../src/scripts/seed/createAdminUser.js");
  await provisionAdminUser({
    email: ORDER_MANAGER_EMAIL,
    password: ORDER_MANAGER_PASSWORD,
    name: "Order Manager Fixture",
    role: "order-manager",
  });
  orderManagerToken = await signInFully(app, ORDER_MANAGER_EMAIL, ORDER_MANAGER_PASSWORD);
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

describe("retry after a failed verification (FR-PAY-011)", () => {
  it("mints a fresh Razorpay order on re-initiation after a failed attempt", async () => {
    const orderId = await seedOrder();
    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      id: "order_polish_first",
      amount: 400000000,
      currency: "INR",
      status: "created",
    });
    await authRequest(app, "post", `/api/orders/${orderId}/payment`, buyerToken);

    await authRequest(app, "post", `/api/orders/${orderId}/payment/verify`, buyerToken).send({
      razorpayOrderId: "order_polish_first",
      razorpayPaymentId: "pay_polish_first",
      razorpaySignature: "not-a-real-signature",
    });

    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      id: "order_polish_retry",
      amount: 400000000,
      currency: "INR",
      status: "created",
    });
    const retry = await authRequest(app, "post", `/api/orders/${orderId}/payment`, buyerToken);

    expect(retry.status).toBe(201);
    expect(retry.body.data.razorpayOrderId).toBe("order_polish_retry");
    expect(createRazorpayOrder).toHaveBeenCalledTimes(2);
  });
});

describe("payment summary on order reads (#168)", () => {
  it("GET /api/orders/:id includes a payment summary once a payment attempt exists", async () => {
    const orderId = await seedOrder();

    const beforeInitiate = await authRequest(app, "get", `/api/orders/${orderId}`, buyerToken);
    expect(beforeInitiate.body.data.payment).toBeNull();

    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      id: "order_polish_summary",
      amount: 400000000,
      currency: "INR",
      status: "created",
    });
    await authRequest(app, "post", `/api/orders/${orderId}/payment`, buyerToken);

    const afterInitiate = await authRequest(app, "get", `/api/orders/${orderId}`, buyerToken);
    expect(afterInitiate.body.data.payment).toMatchObject({ status: "created", amount: 400000000 });
  });

  it("GET/list /api/admin/orders include the same payment summary", async () => {
    const orderId = await seedOrder();
    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      id: "order_polish_admin",
      amount: 400000000,
      currency: "INR",
      status: "created",
    });
    await authRequest(app, "post", `/api/orders/${orderId}/payment`, buyerToken);

    const detail = await authRequest(
      app,
      "get",
      `/api/admin/orders/${orderId}`,
      orderManagerToken,
    );
    expect(detail.body.data.payment).toMatchObject({ status: "created", amount: 400000000 });

    const list = await authRequest(app, "get", "/api/admin/orders", orderManagerToken);
    const listed = list.body.data.find((order: { id: string }) => order.id === orderId);
    expect(listed.payment).toMatchObject({ status: "created", amount: 400000000 });
  });
});

describe("error envelope audit (SRS v0.6 §5)", () => {
  it("PAYMENT_NOT_ALLOWED matches {success:false, code, message}", async () => {
    const orderId = await seedOrder();
    await authRequest(app, "post", `/api/orders/${orderId}/cancel`, buyerToken);

    const res = await authRequest(app, "post", `/api/orders/${orderId}/payment`, buyerToken);

    expect(res.status).toBe(400);
    assertErrorEnvelope(res.body);
    expect(res.body.code).toBe("PAYMENT_NOT_ALLOWED");
  });

  it("PAYMENT_VERIFICATION_FAILED matches {success:false, code, message}", async () => {
    const orderId = await seedOrder();
    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      id: "order_polish_envelope",
      amount: 400000000,
      currency: "INR",
      status: "created",
    });
    await authRequest(app, "post", `/api/orders/${orderId}/payment`, buyerToken);

    const res = await authRequest(app, "post", `/api/orders/${orderId}/payment/verify`, buyerToken).send({
      razorpayOrderId: "order_polish_envelope",
      razorpayPaymentId: "pay_x",
      razorpaySignature: "bad",
    });

    expect(res.status).toBe(400);
    assertErrorEnvelope(res.body);
    expect(res.body.code).toBe("PAYMENT_VERIFICATION_FAILED");
  });

  it("REFUND_AMOUNT_INVALID matches {success:false, code, message}", async () => {
    const orderId = await seedOrder();
    const razorpayOrderId = "order_polish_refund_envelope";
    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      id: razorpayOrderId,
      amount: 400000000,
      currency: "INR",
      status: "created",
    });
    await authRequest(app, "post", `/api/orders/${orderId}/payment`, buyerToken);
    const razorpayPaymentId = "pay_polish_refund_envelope";
    await authRequest(app, "post", `/api/orders/${orderId}/payment/verify`, buyerToken).send({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: signPayment(razorpayOrderId, razorpayPaymentId),
    });

    const res = await authRequest(
      app,
      "post",
      `/api/admin/orders/${orderId}/refund`,
      orderManagerToken,
    ).send({ amount: 999999999, reason: "Too much" });

    expect(res.status).toBe(400);
    assertErrorEnvelope(res.body);
    expect(res.body.code).toBe("REFUND_AMOUNT_INVALID");
  });

  it("MISSING_WEBHOOK_SIGNATURE matches {success:false, code, message}", async () => {
    const res = await authRequest(app, "post", "/api/webhooks/razorpay", buyerToken);

    expect(res.status).toBe(400);
    assertErrorEnvelope(res.body);
    expect(res.body.code).toBe("MISSING_WEBHOOK_SIGNATURE");
  });
});
