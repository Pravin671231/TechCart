import crypto from "node:crypto";
import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M6 / Issue #167 — admin-initiated refunds, real DB (the role boundary and
// the refundable-balance math are the actual behavior under test). Order
// creation still mocks the Razorpay SDK's own network calls; the refund
// itself is verified against a genuinely captured payment reached via the
// real initiate -> verify path (self-signed HMAC, same convention as #165).
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

import { createRazorpayOrder, createRazorpayRefund } from "@/externalService/razorpay";
import { Product } from "@/modules/product-catalog/features/products/products.model";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const ORDER_MANAGER_EMAIL = "refunds-order-manager@example.com";
const ORDER_MANAGER_PASSWORD = "OrderMgr!Pass1";
const CATALOG_MANAGER_EMAIL = "refunds-catalog-manager@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";
const BUYER_EMAIL = "refunds-buyer@example.com";
const KEY_SECRET = "test-razorpay-key-secret";

let ctx: MemoryMongoContext;
let app: Express;
let orderManagerToken: string;
let catalogManagerToken: string;
let buyerToken: string;

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

async function seedPaidOrder(razorpayOrderId: string): Promise<string> {
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
  const checkout = await authRequest(app, "post", "/api/orders", buyerToken).send({
    shippingAddress: validAddress,
  });
  const orderId = checkout.body.data.id as string;

  vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
    id: razorpayOrderId,
    amount: 400000000,
    currency: "INR",
    status: "created",
  });
  await authRequest(app, "post", `/api/orders/${orderId}/payment`, buyerToken);

  const razorpayPaymentId = `pay_${razorpayOrderId}`;
  await authRequest(app, "post", `/api/orders/${orderId}/payment/verify`, buyerToken).send({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature: signPayment(razorpayOrderId, razorpayPaymentId),
  });

  return orderId;
}

function admin(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, orderManagerToken);
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;

  const { provisionAdminUser } = await import("../../../src/scripts/seed/createAdminUser.js");
  await provisionAdminUser({
    email: ORDER_MANAGER_EMAIL,
    password: ORDER_MANAGER_PASSWORD,
    name: "Order Manager Fixture",
    role: "order-manager",
  });
  orderManagerToken = await signInFully(app, ORDER_MANAGER_EMAIL, ORDER_MANAGER_PASSWORD);

  await provisionAdminUser({
    email: CATALOG_MANAGER_EMAIL,
    password: CATALOG_MANAGER_PASSWORD,
    name: "Catalog Manager Fixture",
    role: "catalog-manager",
  });
  catalogManagerToken = await signInFully(app, CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);

  buyerToken = await signInBuyer(app, BUYER_EMAIL);
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

describe("POST /api/admin/orders/:id/refund (FR-PAY-012-018)", () => {
  it("rejects a catalog-manager session 403", async () => {
    const orderId = await seedPaidOrder("order_refund_rbac");

    const res = await authRequest(
      app,
      "post",
      `/api/admin/orders/${orderId}/refund`,
      catalogManagerToken,
    ).send({ reason: "Test" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("a full refund (amount omitted) refunds the whole balance and transitions the order to refunded", async () => {
    const orderId = await seedPaidOrder("order_refund_full");
    vi.mocked(createRazorpayRefund).mockResolvedValue({
      id: "rfnd_full",
      amount: 400000000,
      status: "processed",
    });

    const res = await admin("post", `/api/admin/orders/${orderId}/refund`).send({
      reason: "Customer request",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("refunded");
    expect(createRazorpayRefund).toHaveBeenCalledWith(expect.any(String), 4000000);
  });

  it("a partial refund leaves the order's own status untouched", async () => {
    const orderId = await seedPaidOrder("order_refund_partial");
    vi.mocked(createRazorpayRefund).mockResolvedValue({
      id: "rfnd_partial",
      amount: 1000000,
      status: "processed",
    });

    const res = await admin("post", `/api/admin/orders/${orderId}/refund`).send({
      amount: 1000000,
      reason: "Partial goodwill refund",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("paid");
  });

  it("rejects an amount exceeding the refundable balance", async () => {
    const orderId = await seedPaidOrder("order_refund_over");

    const res = await admin("post", `/api/admin/orders/${orderId}/refund`).send({
      amount: 999999999,
      reason: "Too much",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REFUND_AMOUNT_INVALID");
    expect(createRazorpayRefund).not.toHaveBeenCalled();
  });

  it("rejects refunding an order with no captured payment", async () => {
    const product = await Product.create({
      name: "Unpaid Phone",
      slug: `unpaid-${new Types.ObjectId().toString()}`,
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
    const checkout = await authRequest(app, "post", "/api/orders", buyerToken).send({
      shippingAddress: validAddress,
    });
    const orderId = checkout.body.data.id as string;

    const res = await admin("post", `/api/admin/orders/${orderId}/refund`).send({
      reason: "No payment yet",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REFUND_NOT_ALLOWED");
  });
});
