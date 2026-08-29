import crypto from "node:crypto";
import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import request from "supertest";

// Issue #171/M7.1 — real DB (the aggregation math and role boundary are the
// actual behavior under test). Same full-mock-not-partial-mock convention
// refunds.api.test.ts already established for @/externalService/razorpay,
// for the identical env-freeze reason documented there.
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
import * as ordersRepository from "@/modules/orders/orders.repository";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../testHelpers/adminSession";

const ORDER_MANAGER_EMAIL = "dashboard-order-manager@example.com";
const ORDER_MANAGER_PASSWORD = "OrderMgr!Pass1";
const CATALOG_MANAGER_EMAIL = "dashboard-catalog-manager@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";
const BUYER_EMAIL = "dashboard-buyer@example.com";
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

async function seedPaidOrder(name: string, sellingPrice: number): Promise<string> {
  const product = await Product.create({
    name,
    slug: `dash-${new Types.ObjectId().toString()}`,
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

function admin(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, orderManagerToken);
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;

  const { provisionAdminUser } = await import("../../src/scripts/seed/createAdminUser.js");
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
  // Dynamic import — @/lib/cache imports @/config/env at its own top level,
  // and a static import here would force that module to evaluate as soon as
  // this test file loads, before bootstrapMemoryMongo() (in beforeAll, which
  // always runs first) sets the real MONGODB_URI — freezing env.MONGODB_URI
  // on vitest.config.ts's placeholder for this file's whole run. Same bug
  // class documented in orders.service.ts/refunds.api.test.ts.
  const { resetDashboardCache } = await import("../../src/lib/cache.js");
  resetDashboardCache();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/dashboard/summary (FR-DASH-001/003/004)", () => {
  it("rejects a catalog-manager session 403", async () => {
    const res = await authRequest(app, "get", "/api/admin/dashboard/summary", catalogManagerToken);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("401s with no session", async () => {
    const res = await request(app).get("/api/admin/dashboard/summary");
    expect(res.status).toBe(401);
  });

  it("reports totalOrders/ordersByStatus and revenue in whole rupees", async () => {
    await seedPaidOrder("Dashboard Phone A", 15000);
    await seedPaidOrder("Dashboard Phone B", 25000);

    const res = await admin("get", "/api/admin/dashboard/summary");
    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(2);
    expect(res.body.data.ordersByStatus.paid).toBe(2);
    expect(res.body.data.totalRevenue).toBe(40000);
  });

  it("rejects an invalid date range", async () => {
    const res = await admin("get", "/api/admin/dashboard/summary?from=2026-02-01&to=2026-01-01");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_DATE_RANGE");
  });

  it("caches the aggregation result for repeated calls within the TTL", async () => {
    await seedPaidOrder("Dashboard Phone C", 10000);
    const spy = vi.spyOn(ordersRepository, "countAndRevenueInRange");

    await admin("get", "/api/admin/dashboard/summary?from=2026-01-01&to=2026-12-31");
    await admin("get", "/api/admin/dashboard/summary?from=2026-01-01&to=2026-12-31");

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("GET /api/admin/dashboard/sales (FR-DASH-005/018)", () => {
  it("returns a zero-filled series and rejects catalog-manager", async () => {
    const forbidden = await authRequest(
      app,
      "get",
      "/api/admin/dashboard/sales",
      catalogManagerToken,
    );
    expect(forbidden.status).toBe(403);

    const res = await admin("get", "/api/admin/dashboard/sales?from=2026-01-01&to=2026-01-05");
    expect(res.status).toBe(200);
    expect(res.body.data.bucket).toBe("day");
    expect(res.body.data.series).toHaveLength(5);
    expect(res.body.data.series.every((p: { revenue: number }) => p.revenue === 0)).toBe(true);
  });
});

describe("GET /api/admin/dashboard/top-products (FR-DASH-006/017)", () => {
  it("ranks products by revenue desc", async () => {
    await seedPaidOrder("Top Product A", 50000);
    await seedPaidOrder("Top Product B", 10000);

    const res = await admin("get", "/api/admin/dashboard/top-products");
    expect(res.status).toBe(200);
    expect(res.body.data.products[0].name).toBe("Top Product A");
    expect(res.body.data.products[0].revenue).toBe(50000);
  });
});
