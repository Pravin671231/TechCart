import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M6 / Issue #164 — payment initiation, real DB (ownership/status guards are
// the actual behavior under test, same rationale every orders suite in M5
// documents). The Razorpay SDK's own network call is mocked wholesale — only
// HMAC signature verification is exercised for real, and that's not this
// endpoint's concern.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/externalService/razorpay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/externalService/razorpay")>();
  return {
    ...actual,
    createRazorpayOrder: vi.fn(),
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

const BUYER_EMAIL = "payments-init-buyer@example.com";
const OTHER_BUYER_EMAIL = "payments-init-other@example.com";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;
let otherToken: string;

const validAddress = {
  fullName: "Asha Rao",
  phone: "9876543210",
  line1: "221B, Residency Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560025",
};

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

function req(method: "get" | "post" | "patch" | "delete", url: string, authToken = token) {
  return authRequest(app, method, url, authToken);
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;
  token = await signInBuyer(app, BUYER_EMAIL);
  otherToken = await signInBuyer(app, OTHER_BUYER_EMAIL);
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
  await ctx.mongoose.connection.db!.collection("payments").deleteMany({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/orders/:id/payment (FR-PAY-001-004)", () => {
  it("mints a Razorpay order in integer paise and returns the checkout-widget fields", async () => {
    const orderId = await seedOrder(token);
    vi.mocked(createRazorpayOrder).mockResolvedValue({
      id: "order_razorpaytest1",
      amount: 4000000,
      currency: "INR",
      status: "created",
    });

    const res = await req("post", `/api/orders/${orderId}/payment`);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      razorpayOrderId: "order_razorpaytest1",
      amount: 4000000,
      currency: "INR",
    });
    expect(res.body.data.keyId).toEqual(expect.any(String));
    expect(res.body.data).not.toHaveProperty("keySecret");
  });

  it("is idempotent — a second call reuses the same Razorpay order, no second SDK call", async () => {
    const orderId = await seedOrder(token);
    vi.mocked(createRazorpayOrder).mockResolvedValue({
      id: "order_razorpaytest2",
      amount: 4000000,
      currency: "INR",
      status: "created",
    });

    const first = await req("post", `/api/orders/${orderId}/payment`);
    const second = await req("post", `/api/orders/${orderId}/payment`);

    expect(first.body.data.razorpayOrderId).toBe(second.body.data.razorpayOrderId);
    expect(createRazorpayOrder).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-owned order with the same not-found error as a nonexistent one", async () => {
    const otherOrderId = await seedOrder(otherToken);

    const owned = await req("post", `/api/orders/${otherOrderId}/payment`);
    const nonexistent = await req("post", "/api/orders/000000000000000000000000/payment");

    expect(owned.status).toBe(404);
    expect(owned.body.code).toBe("ORDER_NOT_FOUND");
    expect(nonexistent.status).toBe(404);
    expect(nonexistent.body.code).toBe("ORDER_NOT_FOUND");
    expect(createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("rejects initiating payment for an order that isn't pending_payment", async () => {
    const orderId = await seedOrder(token);
    await req("post", `/api/orders/${orderId}/cancel`);

    const res = await req("post", `/api/orders/${orderId}/payment`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PAYMENT_NOT_ALLOWED");
  });
});
