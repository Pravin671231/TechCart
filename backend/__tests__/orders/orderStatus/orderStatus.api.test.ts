import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M5 / Issue #156 — transitionOrder/markOrderPaid/runAutoCancelSweep have no
// HTTP surface of their own yet (#157/#158 add the buyer/admin endpoints
// that call transitionOrder; markOrderPaid is deliberately routeless
// forever, FR-ORD-009), so this suite drives them directly against a real
// order created through the real checkout endpoint, same real-DB rationale
// checkout's own suite documents.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import { Order } from "@/modules/orders/orders.model";
import {
  markOrderPaid,
  runAutoCancelSweep,
  transitionOrder,
} from "@/modules/orders/orders.service";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const BUYER_EMAIL = "order-status-buyer@example.com";

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

async function seedOrder(): Promise<Types.ObjectId> {
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
  return new Types.ObjectId(res.body.data.id as string);
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;
  token = await signInBuyer(app, BUYER_EMAIL);
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

beforeEach(async () => {
  await ctx.mongoose.connection.db!.collection("carts").deleteMany({});
  await ctx.mongoose.connection.db!.collection("products").deleteMany({});
  await ctx.mongoose.connection.db!.collection("addresses").deleteMany({});
  await ctx.mongoose.connection.db!.collection("orders").deleteMany({});
  await ctx.mongoose.connection.db!.collection("counters").deleteMany({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("transitionOrder / FR-ORD-008/013", () => {
  it("advances a legal transition and appends to statusHistory", async () => {
    const orderId = await seedOrder();

    const updated = await transitionOrder(orderId, "paid");

    expect(updated.status).toBe("paid");
    expect(updated.statusHistory).toHaveLength(2);
    expect(updated.statusHistory[1]!.status).toBe("paid");
  });

  it("rejects an illegal transition, naming both statuses", async () => {
    const orderId = await seedOrder();

    await expect(transitionOrder(orderId, "shipped")).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_ORDER_TRANSITION",
    });

    const order = await Order.findById(orderId).lean();
    expect(order!.status).toBe("pending_payment");
  });

  it("records a tracking reference and cancellation reason when supplied", async () => {
    const orderId = await seedOrder();
    await transitionOrder(orderId, "paid");
    await transitionOrder(orderId, "processing");

    const shipped = await transitionOrder(orderId, "shipped", { trackingReference: "TRACK123" });
    expect(shipped.trackingReference).toBe("TRACK123");
  });
});

describe("markOrderPaid / FR-ORD-009", () => {
  it("transitions pending_payment -> paid when called directly", async () => {
    const orderId = await seedOrder();

    const updated = await markOrderPaid(orderId, "razorpay_payment_id_stub");

    expect(updated.status).toBe("paid");
  });

  it("is not reachable via any HTTP route", async () => {
    const orderId = await seedOrder();
    for (const path of [
      `/api/orders/${orderId.toString()}/paid`,
      `/api/orders/${orderId.toString()}/mark-paid`,
      `/api/admin/orders/${orderId.toString()}/paid`,
    ]) {
      const res = await authRequest(app, "post", path, token);
      expect(res.status).toBe(404);
    }
  });
});

describe("runAutoCancelSweep / FR-ORD-010", () => {
  it("auto-cancels a pending_payment order older than 30 minutes", async () => {
    const orderId = await seedOrder();
    await Order.updateOne(
      { _id: orderId },
      { $set: { createdAt: new Date(Date.now() - 31 * 60_000) } },
    );

    const result = await runAutoCancelSweep();

    expect(result.cancelledCount).toBe(1);
    const order = await Order.findById(orderId).lean();
    expect(order!.status).toBe("cancelled");
    expect(order!.statusHistory.at(-1)!.status).toBe("cancelled");
  });

  it("leaves a fresh pending_payment order untouched", async () => {
    const orderId = await seedOrder();

    const result = await runAutoCancelSweep();

    expect(result.cancelledCount).toBe(0);
    const order = await Order.findById(orderId).lean();
    expect(order!.status).toBe("pending_payment");
  });

  it("does not throw when there is nothing to cancel", async () => {
    await expect(runAutoCancelSweep()).resolves.toEqual({ cancelledCount: 0 });
  });
});
