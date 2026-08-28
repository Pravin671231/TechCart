import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M5 / Issue #155 — checkout resolves live pricing/availability from real
// Product documents (via cart.service) and writes real Address/Cart/Order
// documents, so this suite runs end to end against a real DB, same
// rationale cart's and addresses' own Supertest suites document.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const BUYER_EMAIL = "checkout-buyer@example.com";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;

async function seedProduct(
  overrides: { variantASellingPrice?: number; variantBActive?: boolean } = {},
) {
  const doc = await Product.create({
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
        sku: `SKU-A-${new Types.ObjectId().toString()}`,
        attributes: [{ name: "Color", value: "Black" }],
        images: [{ url: "https://cdn.test/a.webp", alt: "A", isPrimary: true }],
        mrp: 5000000,
        discount: 20,
        sellingPrice: overrides.variantASellingPrice ?? 4000000,
        active: true,
      },
      {
        sku: `SKU-B-${new Types.ObjectId().toString()}`,
        attributes: [{ name: "Color", value: "Blue" }],
        images: [{ url: "https://cdn.test/b.webp", alt: "B", isPrimary: true }],
        mrp: 5200000,
        discount: 0,
        sellingPrice: 5200000,
        active: overrides.variantBActive ?? true,
      },
    ],
  });
  return { productId: doc._id, variantA: doc.variants[0]!._id, variantB: doc.variants[1]!._id };
}

function req(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, token);
}

const validAddress = {
  fullName: "Asha Rao",
  phone: "9876543210",
  line1: "221B, Residency Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560025",
};

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

describe("POST /api/orders (checkout)", () => {
  it("creates a pending_payment order with a unique order number, clears the cart (FR-ORD-001/005/006/007)", async () => {
    const { variantA } = await seedProduct();
    await req("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 2 });

    const res = await req("post", "/api/orders").send({ shippingAddress: validAddress });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending_payment");
    expect(res.body.data.orderNumber).toMatch(/^TC-\d{4}-\d{6}$/);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.totalAmount).toBe(8000000);
    expect(res.body.data.statusHistory).toHaveLength(1);
    expect(res.body.data.statusHistory[0].status).toBe("pending_payment");

    const cart = await req("get", "/api/cart");
    expect(cart.body.data.items).toHaveLength(0);
  });

  it("allocates sequential order numbers across checkouts", async () => {
    const first = await seedProduct();
    await req("post", "/api/cart/items").send({
      variantId: first.variantA.toString(),
      quantity: 1,
    });
    const res1 = await req("post", "/api/orders").send({ shippingAddress: validAddress });

    const second = await seedProduct();
    await req("post", "/api/cart/items").send({
      variantId: second.variantA.toString(),
      quantity: 1,
    });
    const res2 = await req("post", "/api/orders").send({ shippingAddress: validAddress });

    const seq1 = Number(res1.body.data.orderNumber.split("-")[2]);
    const seq2 = Number(res2.body.data.orderNumber.split("-")[2]);
    expect(seq2).toBe(seq1 + 1);
  });

  it("rejects checkout on a cart with zero available lines (FR-ORD-002)", async () => {
    const res = await req("post", "/api/orders").send({ shippingAddress: validAddress });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CART_EMPTY");
  });

  it("treats a cart of only unavailable lines as empty", async () => {
    const { productId, variantA } = await seedProduct();
    await req("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });
    await Product.updateOne(
      { _id: productId, "variants._id": variantA },
      { $set: { "variants.$.active": false } },
    );

    const res = await req("post", "/api/orders").send({ shippingAddress: validAddress });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CART_EMPTY");
  });

  it("ignores a client-supplied totalAmount — always server-computed (FR-ORD-005/027)", async () => {
    const { variantA } = await seedProduct({ variantASellingPrice: 4000000 });
    await req("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });

    const res = await req("post", "/api/orders").send({
      shippingAddress: validAddress,
      totalAmount: 1,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(4000000);
  });

  describe("address resolution (FR-ORD-004/033)", () => {
    it("accepts a saved addressId", async () => {
      const { variantA } = await seedProduct();
      await req("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });
      const saved = await req("post", "/api/addresses").send(validAddress);

      const res = await req("post", "/api/orders").send({ addressId: saved.body.data._id });

      expect(res.status).toBe(201);
      expect(res.body.data.shippingAddress).toMatchObject({ city: "Bengaluru" });
    });

    it("saves an inline address to the address book as a side effect", async () => {
      const { variantA } = await seedProduct();
      await req("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });

      await req("post", "/api/orders").send({ shippingAddress: validAddress });

      const addresses = await req("get", "/api/addresses");
      expect(addresses.body.data).toHaveLength(1);
    });

    it("rejects a malformed inline PIN code", async () => {
      const { variantA } = await seedProduct();
      await req("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });

      const res = await req("post", "/api/orders").send({
        shippingAddress: { ...validAddress, pincode: "1234" },
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("falls back to the buyer's default address when neither addressId nor inline is given", async () => {
      const { variantA } = await seedProduct();
      await req("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });
      const saved = await req("post", "/api/addresses").send(validAddress);
      await req("patch", `/api/addresses/${saved.body.data._id}/default`);

      const res = await req("post", "/api/orders").send({});

      expect(res.status).toBe(201);
      expect(res.body.data.shippingAddress).toMatchObject({ city: "Bengaluru" });
    });

    it("rejects checkout with no address supplied and no default set", async () => {
      const { variantA } = await seedProduct();
      await req("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });

      const res = await req("post", "/api/orders").send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ADDRESS_REQUIRED");
    });
  });

  it("drops a since-unavailable line into droppedItems while the rest of checkout succeeds (FR-ORD-025)", async () => {
    const { productId, variantA, variantB } = await seedProduct();
    await req("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });
    await req("post", "/api/cart/items").send({ variantId: variantB.toString(), quantity: 1 });
    await Product.updateOne(
      { _id: productId, "variants._id": variantB },
      { $set: { "variants.$.active": false } },
    );

    const res = await req("post", "/api/orders").send({ shippingAddress: validAddress });

    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.droppedItems).toHaveLength(1);
    expect(res.body.data.droppedItems[0].reason).toBe("VARIANT_UNAVAILABLE");

    // The dropped line stays in the cart; the ordered line was cleared.
    const cart = await req("get", "/api/cart");
    expect(cart.body.data.items).toHaveLength(1);
    expect(cart.body.data.items[0].variant.id).toBe(variantB.toString());
  });
});
