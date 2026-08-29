import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// M4 / Issues #150-#151 — the cart module's endpoints are all gated by
// rbac(["buyer"]), which needs a real session to resolve. Unlike the catalog
// admin suites (which mock their own repository), this suite runs against a
// real DB end to end: cart.service resolves live pricing/availability from
// real Product documents, so the persistence and resolution logic is what's
// actually under test here.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import { Warehouse } from "@/modules/inventory/warehouses.model";
import { Inventory } from "@/modules/inventory/inventory.model";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  authRequest,
  seedTestWarehouseStock,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const BUYER_EMAIL = "cart-buyer@example.com";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;

// A helper: build a published product with two active variants.
// Issue #190/M10.2 — cart.service's addItem/updateItem now allocate real
// stock, so every seeded variant needs an inventory row; a generous default
// (999) means every pre-existing test in this file keeps passing unchanged,
// while variantAStock/variantBStock let the new allocation-specific tests
// below control it explicitly.
async function seedProduct(
  overrides: {
    variantASellingPrice?: number;
    variantBActive?: boolean;
    status?: "draft" | "published" | "archived";
    variantAStock?: number;
    variantBStock?: number;
  } = {},
) {
  const doc = await Product.create({
    name: "Nova X5 Pro 5G",
    slug: `nova-${new Types.ObjectId().toString()}`,
    description: "A phone.",
    brand: new Types.ObjectId(),
    category: new Types.ObjectId(),
    specifications: [],
    isFeatured: false,
    status: overrides.status ?? "published",
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
  await seedTestWarehouseStock(doc._id, [doc.variants[0]!._id], overrides.variantAStock ?? 999);
  await seedTestWarehouseStock(doc._id, [doc.variants[1]!._id], overrides.variantBStock ?? 999);
  return {
    productId: doc._id,
    variantA: doc.variants[0]!._id,
    variantB: doc.variants[1]!._id,
  };
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
});

afterEach(() => {
  vi.clearAllMocks();
});

function cartReq(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, token);
}

describe("auth gating (FR-CART-002)", () => {
  it("rejects every cart endpoint with no session", async () => {
    for (const [method, url] of [
      ["get", "/api/cart"],
      ["post", "/api/cart/items"],
      ["patch", `/api/cart/items/${new Types.ObjectId().toString()}`],
      ["delete", `/api/cart/items/${new Types.ObjectId().toString()}`],
      ["delete", "/api/cart"],
    ] as const) {
      const res = await request(app)[method](url);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: "UNAUTHENTICATED" });
    }
  });
});

describe("GET /api/cart", () => {
  it("returns an empty-cart shape (200, never 404) for a buyer who has added nothing", async () => {
    const res = await cartReq("get", "/api/cart");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], itemCount: 0, subtotal: 0 });
    expect(res.body).not.toHaveProperty("pagination");
  });
});

describe("POST /api/cart/items", () => {
  it("adds a variant and computes subtotal/itemCount from its live price", async () => {
    const { variantA } = await seedProduct({ variantASellingPrice: 4000000 });

    const res = await cartReq("post", "/api/cart/items").send({
      variantId: variantA.toString(),
      quantity: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({
      quantity: 2,
      sellingPrice: 4000000,
      lineTotal: 8000000,
      unavailable: false,
    });
    expect(res.body.data.itemCount).toBe(2);
    expect(res.body.data.subtotal).toBe(8000000);
  });

  it("combines a repeat add into one line (FR-CART-004)", async () => {
    const { variantA } = await seedProduct();
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 2 });

    const res = await cartReq("post", "/api/cart/items").send({
      variantId: variantA.toString(),
      quantity: 1,
    });

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(3);
  });

  it("rejects quantity 11 outright with VALIDATION_ERROR, not clamped", async () => {
    const { variantA } = await seedProduct();

    const res = await cartReq("post", "/api/cart/items").send({
      variantId: variantA.toString(),
      quantity: 11,
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an accumulated quantity above the cap with QUANTITY_OUT_OF_RANGE", async () => {
    const { variantA } = await seedProduct();
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 8 });

    const res = await cartReq("post", "/api/cart/items").send({
      variantId: variantA.toString(),
      quantity: 5,
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("QUANTITY_OUT_OF_RANGE");
  });

  it("rejects a nonexistent variant id (FR-CART-009)", async () => {
    const res = await cartReq("post", "/api/cart/items").send({
      variantId: new Types.ObjectId().toString(),
      quantity: 1,
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VARIANT_NOT_FOUND");
  });
});

describe("PATCH /api/cart/items/:variantId", () => {
  it("removes the line when quantity is set to 0 (FR-CART-006)", async () => {
    const { variantA } = await seedProduct();
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 2 });

    const res = await cartReq("patch", `/api/cart/items/${variantA.toString()}`).send({
      quantity: 0,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("404s CART_ITEM_NOT_FOUND for a variant not in the cart", async () => {
    const res = await cartReq("patch", `/api/cart/items/${new Types.ObjectId().toString()}`).send({
      quantity: 3,
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CART_ITEM_NOT_FOUND");
  });
});

describe("DELETE", () => {
  it("removes a single line and clears the whole cart independently (FR-CART-007/008)", async () => {
    const { variantA, variantB } = await seedProduct();
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });
    await cartReq("post", "/api/cart/items").send({ variantId: variantB.toString(), quantity: 1 });

    const afterRemove = await cartReq("delete", `/api/cart/items/${variantA.toString()}`);
    expect(afterRemove.body.data.items).toHaveLength(1);

    const afterClear = await cartReq("delete", "/api/cart");
    expect(afterClear.body.data.items).toHaveLength(0);
    expect(afterClear.body.data.itemCount).toBe(0);
  });
});

describe("live pricing & availability (FR-CART-010/012/017)", () => {
  it("reflects a variant price change on the next GET with no cart-side update", async () => {
    const { productId, variantA } = await seedProduct({ variantASellingPrice: 4000000 });
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });

    await Product.updateOne(
      { _id: productId, "variants._id": variantA },
      { $set: { "variants.$.sellingPrice": 3599900 } },
    );

    const res = await cartReq("get", "/api/cart");
    expect(res.body.data.items[0].sellingPrice).toBe(3599900);
    expect(res.body.data.subtotal).toBe(3599900);
  });

  it("flags a since-deactivated variant unavailable, excludes it from subtotal, still counts it", async () => {
    const { productId, variantA, variantB } = await seedProduct();
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 1 });
    await cartReq("post", "/api/cart/items").send({ variantId: variantB.toString(), quantity: 3 });

    await Product.updateOne(
      { _id: productId, "variants._id": variantB },
      { $set: { "variants.$.active": false } },
    );

    const res = await cartReq("get", "/api/cart");
    const lineB = res.body.data.items.find(
      (line: { variant: { id: string } }) => line.variant.id === variantB.toString(),
    );
    expect(lineB).toMatchObject({ unavailable: true, lineTotal: 0 });
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.subtotal).toBe(4000000); // only line A
    expect(res.body.data.itemCount).toBe(4); // both lines
  });

  it("flags every line unavailable once the parent product is unpublished", async () => {
    const { productId, variantA } = await seedProduct();
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 2 });

    await Product.updateOne({ _id: productId }, { $set: { status: "archived" } });

    const res = await cartReq("get", "/api/cart");
    expect(res.body.data.items[0].unavailable).toBe(true);
    expect(res.body.data.subtotal).toBe(0);
  });
});

// Issue #190/M10.2 (FR-INV-009-011) — cart-time stock allocation. Warehouse
// detail is never part of the API response (it's an internal allocation
// field), so these assert against the real Inventory collection directly.
describe("stock allocation (Issue #190/M10.2)", () => {
  async function stockAt(variantId: Types.ObjectId): Promise<number> {
    const warehouse = await Warehouse.findOne({ code: "TEST-WH" });
    const row = await Inventory.findOne({ variantId, warehouseId: warehouse!._id });
    return row?.stock ?? 0;
  }

  it("decrements real stock on add and restores it on remove (FR-INV-009/011)", async () => {
    const { variantA } = await seedProduct({ variantAStock: 10 });

    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 3 });
    expect(await stockAt(variantA)).toBe(7);

    await cartReq("delete", `/api/cart/items/${variantA.toString()}`);
    expect(await stockAt(variantA)).toBe(10);
  });

  it("rejects adding more than is available with INSUFFICIENT_STOCK, naming the max available (FR-INV-010)", async () => {
    const { variantA } = await seedProduct({ variantAStock: 2 });

    const res = await cartReq("post", "/api/cart/items").send({
      variantId: variantA.toString(),
      quantity: 5,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.message).toContain("2");
    expect(await stockAt(variantA)).toBe(2); // untouched
  });

  it("rejects adding a variant with zero stock anywhere (FR-INV-008)", async () => {
    const { variantA } = await seedProduct({ variantAStock: 0 });

    const res = await cartReq("post", "/api/cart/items").send({
      variantId: variantA.toString(),
      quantity: 1,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
  });

  it("re-checks only the already-allocated warehouse on a repeat add, never re-shopping others (FR-INV-011)", async () => {
    const { variantA } = await seedProduct({ variantAStock: 10 });

    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 4 });
    expect(await stockAt(variantA)).toBe(6);

    const res = await cartReq("post", "/api/cart/items").send({
      variantId: variantA.toString(),
      quantity: 3,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(7);
    expect(await stockAt(variantA)).toBe(3);
  });

  it("rejects a combined-line increase that would exceed the warehouse's remaining stock", async () => {
    const { variantA } = await seedProduct({ variantAStock: 5 });
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 4 });

    const res = await cartReq("post", "/api/cart/items").send({
      variantId: variantA.toString(),
      quantity: 3,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
    expect(await stockAt(variantA)).toBe(1); // untouched by the failed attempt
  });

  it("allocates only the delta on a PATCH increase and restores only the delta on a decrease", async () => {
    const { variantA } = await seedProduct({ variantAStock: 10 });
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 2 });
    expect(await stockAt(variantA)).toBe(8);

    await cartReq("patch", `/api/cart/items/${variantA.toString()}`).send({ quantity: 6 });
    expect(await stockAt(variantA)).toBe(4);

    await cartReq("patch", `/api/cart/items/${variantA.toString()}`).send({ quantity: 3 });
    expect(await stockAt(variantA)).toBe(7);
  });

  it("restores every remaining line's stock on a full cart clear", async () => {
    const { variantA, variantB } = await seedProduct({ variantAStock: 10, variantBStock: 10 });
    await cartReq("post", "/api/cart/items").send({ variantId: variantA.toString(), quantity: 3 });
    await cartReq("post", "/api/cart/items").send({ variantId: variantB.toString(), quantity: 4 });

    await cartReq("delete", "/api/cart");

    expect(await stockAt(variantA)).toBe(10);
    expect(await stockAt(variantB)).toBe(10);
  });
});
