import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Issue #189/M10.1 (FR-INV-007/008) — the buyer-facing 2-state availability
// reinstated after Issue #102 removed stock tracking system-wide, plus the
// reinstated ?inStock=true filter. Fully real-DB: real Product/Warehouse/
// Inventory documents, no repository mocking.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import { Warehouse } from "@/modules/inventory/warehouses.model";
import { Inventory } from "@/modules/inventory/inventory.model";
import { bootstrapMemoryMongo, teardownMemoryMongo, type MemoryMongoContext } from "../testHelpers/adminSession";

let ctx: MemoryMongoContext;
let app: Express;

async function seedProduct(overrides: { variantBActive?: boolean } = {}) {
  return Product.create({
    name: "Nova Availability Phone",
    slug: `nova-availability-${new Types.ObjectId().toString()}`,
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
        mrp: 10000,
        discount: 0,
        sellingPrice: 10000,
        active: true,
      },
      {
        sku: `SKU-B-${new Types.ObjectId().toString()}`,
        attributes: [{ name: "Color", value: "Blue" }],
        images: [{ url: "https://cdn.test/b.webp", alt: "B", isPrimary: true }],
        mrp: 12000,
        discount: 0,
        sellingPrice: 12000,
        active: overrides.variantBActive ?? true,
      },
    ],
  });
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

beforeEach(async () => {
  await Warehouse.deleteMany({});
  await Inventory.deleteMany({});
  await Product.deleteMany({});
});

describe("GET /api/products (FR-INV-007)", () => {
  it("reports in_stock when at least one active variant has stock somewhere", async () => {
    const product = await seedProduct();
    const warehouse = await Warehouse.create({ name: "Mumbai", code: "MUM" });
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[0]!._id,
      warehouseId: warehouse._id,
      stock: 5,
    });
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[1]!._id,
      warehouseId: warehouse._id,
      stock: 0,
    });

    const res = await request(app).get("/api/products");

    const item = res.body.data.find((p: { _id: string }) => p._id === product._id.toString());
    expect(item.availability).toBe("in_stock");
  });

  it("reports out_of_stock when every active variant has zero stock everywhere", async () => {
    const product = await seedProduct();
    const warehouse = await Warehouse.create({ name: "Mumbai", code: "MUM" });
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[0]!._id,
      warehouseId: warehouse._id,
      stock: 0,
    });
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[1]!._id,
      warehouseId: warehouse._id,
      stock: 0,
    });

    const res = await request(app).get("/api/products");

    const item = res.body.data.find((p: { _id: string }) => p._id === product._id.toString());
    expect(item.availability).toBe("out_of_stock");
  });

  it("never exposes any warehouse-level detail", async () => {
    const product = await seedProduct();
    const warehouse = await Warehouse.create({ name: "Mumbai", code: "MUM" });
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[0]!._id,
      warehouseId: warehouse._id,
      stock: 5,
    });

    const res = await request(app).get("/api/products");

    const item = res.body.data.find((p: { _id: string }) => p._id === product._id.toString());
    expect(item).not.toHaveProperty("warehouse");
    expect(JSON.stringify(item)).not.toContain(warehouse._id.toString());
  });

  it("?inStock=true excludes an out-of-stock product and keeps an in-stock one", async () => {
    const inStockProduct = await seedProduct();
    const outOfStockProduct = await seedProduct();
    const warehouse = await Warehouse.create({ name: "Mumbai", code: "MUM" });
    await Inventory.create({
      productId: inStockProduct._id,
      variantId: inStockProduct.variants[0]!._id,
      warehouseId: warehouse._id,
      stock: 3,
    });
    await Inventory.create({
      productId: outOfStockProduct._id,
      variantId: outOfStockProduct.variants[0]!._id,
      warehouseId: warehouse._id,
      stock: 0,
    });

    const res = await request(app).get("/api/products?inStock=true");

    const ids = res.body.data.map((p: { _id: string }) => p._id);
    expect(ids).toContain(inStockProduct._id.toString());
    expect(ids).not.toContain(outOfStockProduct._id.toString());
  });
});

describe("GET /api/products/:slug (FR-INV-007)", () => {
  it("reports each variant's own availability independently", async () => {
    const product = await seedProduct();
    const warehouse = await Warehouse.create({ name: "Mumbai", code: "MUM" });
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[0]!._id,
      warehouseId: warehouse._id,
      stock: 5,
    });
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[1]!._id,
      warehouseId: warehouse._id,
      stock: 0,
    });

    const res = await request(app).get(`/api/products/${product.slug}`);

    const variantA = res.body.data.variants.find(
      (v: { _id: string }) => v._id === product.variants[0]!._id.toString(),
    );
    const variantB = res.body.data.variants.find(
      (v: { _id: string }) => v._id === product.variants[1]!._id.toString(),
    );
    expect(variantA.availability).toBe("in_stock");
    expect(variantB.availability).toBe("out_of_stock");
  });
});
