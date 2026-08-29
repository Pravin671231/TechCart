import crypto from "node:crypto";
import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import request from "supertest";

// Issue #173/M7.3 — real DB (the lifetime stats math and empty-state shape
// are the actual behavior under test). Same full-mock convention as
// refunds.api.test.ts/salesDashboard.api.test.ts for the identical
// env-freeze reason documented there.
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
  authRequest,
  seedTestWarehouseStock,
  type MemoryMongoContext,
} from "../testHelpers/adminSession";

const BUYER_EMAIL = "account-dashboard-buyer@example.com";
const NEW_BUYER_EMAIL = "account-dashboard-new-buyer@example.com";
const KEY_SECRET = "test-razorpay-key-secret";

let ctx: MemoryMongoContext;
let app: Express;
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

async function seedPaidOrder(name: string, sellingPrice: number): Promise<string> {
  const product = await Product.create({
    name,
    slug: `dash-account-${new Types.ObjectId().toString()}`,
    description: "A dashboard fixture product.",
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
        mrp: sellingPrice,
        discount: 0,
        sellingPrice,
        active: true,
      },
    ],
  });
  const variantId = product.variants[0]!._id;
  await seedTestWarehouseStock(product._id, [variantId]);
  await authRequest(app, "post", "/api/cart/items", buyerToken).send({
    variantId: variantId.toString(),
    quantity: 1,
  });
  const checkout = await authRequest(app, "post", "/api/orders", buyerToken).send({
    shippingAddress: validAddress,
  });
  const orderId = checkout.body.data.id as string;

  const razorpayOrderId = `order_${new Types.ObjectId().toString()}`;
  vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
    id: razorpayOrderId,
    amount: sellingPrice * 100,
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

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;
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
  const { resetDashboardCache } = await import("../../src/lib/cache.js");
  resetDashboardCache();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/account/dashboard (FR-DASH-010-012)", () => {
  it("401s with no session", async () => {
    const res = await request(app).get("/api/account/dashboard");
    expect(res.status).toBe(401);
  });

  it("returns profile, recent orders, and lifetime stats net of refunds", async () => {
    await seedPaidOrder("Account Dashboard Phone A", 15000);
    await seedPaidOrder("Account Dashboard Phone B", 25000);

    const res = await authRequest(app, "get", "/api/account/dashboard", buyerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.profile.email).toBe(BUYER_EMAIL);
    expect(res.body.data.recentOrders).toHaveLength(2);
    expect(res.body.data.lifetimeOrderCount).toBe(2);
    expect(res.body.data.lifetimeAmountSpent).toBe(40000);
  });

  it("returns an empty-state shape for a buyer with no orders, not an error", async () => {
    const newBuyerToken = await signInBuyer(app, NEW_BUYER_EMAIL);

    const res = await authRequest(app, "get", "/api/account/dashboard", newBuyerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.recentOrders).toEqual([]);
    expect(res.body.data.lifetimeOrderCount).toBe(0);
    expect(res.body.data.lifetimeAmountSpent).toBe(0);
  });
});
