import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M5 / Issue #157 — buyer order history/detail/cancel, real DB (ownership
// filtering and status-gated cancellation are the actual behavior under
// test), same rationale every other orders suite in this milestone documents.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import { transitionOrder } from "@/modules/orders/orders.service";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const BUYER_EMAIL = "buyer-orders-buyer@example.com";
const OTHER_BUYER_EMAIL = "buyer-orders-other@example.com";

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

async function seedOrder(authToken: string): Promise<{ id: string; _idOid: Types.ObjectId }> {
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
  const id = res.body.data.id as string;
  return { id, _idOid: new Types.ObjectId(id) };
}

function req(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, token);
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/orders (FR-ORD-011)", () => {
  it("lists only the signed-in buyer's own orders, newest first, paginated", async () => {
    await seedOrder(token);
    await seedOrder(token);
    await seedOrder(otherToken);

    const res = await req("get", "/api/orders");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 2 });
  });
});

describe("GET /api/orders/:id (FR-ORD-012/013)", () => {
  it("returns full detail including statusHistory for the owning buyer", async () => {
    const { id } = await seedOrder(token);

    const res = await req("get", `/api/orders/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.statusHistory).toHaveLength(1);
  });

  it("returns the identical not-found error for another buyer's order id as for a nonexistent one", async () => {
    const { id: otherOrderId } = await seedOrder(otherToken);

    const ownedByOther = await req("get", `/api/orders/${otherOrderId}`);
    const nonexistent = await req("get", "/api/orders/000000000000000000000000");

    expect(ownedByOther.status).toBe(404);
    expect(ownedByOther.body.code).toBe("ORDER_NOT_FOUND");
    expect(nonexistent.status).toBe(404);
    expect(nonexistent.body.code).toBe("ORDER_NOT_FOUND");
  });
});

describe("POST /api/orders/:id/cancel (FR-ORD-014)", () => {
  it("cancels a pending_payment order", async () => {
    const { id } = await seedOrder(token);

    const res = await req("post", `/api/orders/${id}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cancelled");
  });

  it("cancels a paid order", async () => {
    const { id, _idOid } = await seedOrder(token);
    await transitionOrder(_idOid, "paid");

    const res = await req("post", `/api/orders/${id}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cancelled");
  });

  it("rejects cancelling a processing-or-later order, naming the current status", async () => {
    const { id, _idOid } = await seedOrder(token);
    await transitionOrder(_idOid, "paid");
    await transitionOrder(_idOid, "processing");

    const res = await req("post", `/api/orders/${id}/cancel`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_ORDER_TRANSITION");
    expect(res.body.message).toContain("processing");
  });

  it("returns the identical not-found error for another buyer's order id", async () => {
    const { id: otherOrderId } = await seedOrder(otherToken);

    const res = await req("post", `/api/orders/${otherOrderId}/cancel`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ORDER_NOT_FOUND");
  });
});
