import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import { Warehouse } from "@/modules/inventory/warehouses.model";
import { Inventory } from "@/modules/inventory/inventory.model";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../testHelpers/adminSession";

const CATALOG_MANAGER_EMAIL = "inventory-catalog-manager@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;

async function seedProduct(name: string, sku: string) {
  return Product.create({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${new Types.ObjectId().toString()}`,
    description: "A product.",
    brand: new Types.ObjectId(),
    category: new Types.ObjectId(),
    specifications: [],
    isFeatured: false,
    status: "published",
    variants: [
      {
        sku,
        attributes: [{ name: "Color", value: "Black" }],
        images: [{ url: "https://cdn.test/a.webp", alt: "A", isPrimary: true }],
        mrp: 10000,
        discount: 0,
        sellingPrice: 10000,
        active: true,
      },
    ],
  });
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;

  const { provisionAdminUser } = await import("../../src/scripts/seed/createAdminUser.js");
  await provisionAdminUser({
    email: CATALOG_MANAGER_EMAIL,
    password: CATALOG_MANAGER_PASSWORD,
    name: "Inventory Catalog Manager Fixture",
    role: "catalog-manager",
  });
  token = await signInFully(app, CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

beforeEach(async () => {
  await Warehouse.deleteMany({});
  await Inventory.deleteMany({});
  await Product.deleteMany({});
});

afterEach(() => {
  vi.clearAllMocks();
});

function admin(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, token);
}

describe("GET /api/admin/inventory", () => {
  it("returns a paginated table enriched with product name, variant sku, and warehouse name", async () => {
    const whRes = await admin("post", "/api/admin/warehouses").send({ name: "Mumbai", code: "MUM" });
    const warehouseId = whRes.body.data._id;
    const product = await seedProduct("Nova Phone", "SKU-NOVA-1");
    // The warehouse was created before the product, so no backfill row exists
    // yet for it — the variant's own addVariant path never ran either (this
    // is a directly-seeded Product, not created through the API), so seed
    // the row directly to isolate this test from #189's own backfill path.
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[0]!._id,
      warehouseId,
      stock: 7,
    });

    const res = await admin("get", "/api/admin/inventory");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      productName: "Nova Phone",
      variantSku: "SKU-NOVA-1",
      warehouseName: "Mumbai",
      stock: 7,
    });
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  it("filters by warehouseId", async () => {
    const whA = await admin("post", "/api/admin/warehouses").send({ name: "Mumbai", code: "MUM" });
    const whB = await admin("post", "/api/admin/warehouses").send({ name: "Delhi", code: "DEL" });
    const product = await seedProduct("Nova Phone", "SKU-NOVA-2");
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[0]!._id,
      warehouseId: whA.body.data._id,
      stock: 3,
    });
    await Inventory.create({
      productId: product._id,
      variantId: product.variants[0]!._id,
      warehouseId: whB.body.data._id,
      stock: 5,
    });

    const res = await admin("get", `/api/admin/inventory?warehouseId=${whA.body.data._id}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ warehouseName: "Mumbai", stock: 3 });
  });

  it("searches by product name", async () => {
    const whRes = await admin("post", "/api/admin/warehouses").send({ name: "Mumbai", code: "MUM" });
    const productA = await seedProduct("Nova Phone", "SKU-A");
    const productB = await seedProduct("Zen Tablet", "SKU-B");
    await Inventory.create({
      productId: productA._id,
      variantId: productA.variants[0]!._id,
      warehouseId: whRes.body.data._id,
      stock: 1,
    });
    await Inventory.create({
      productId: productB._id,
      variantId: productB.variants[0]!._id,
      warehouseId: whRes.body.data._id,
      stock: 1,
    });

    const res = await admin("get", "/api/admin/inventory?search=Nova");

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ productName: "Nova Phone" });
  });
});

describe("PATCH /api/admin/inventory/:inventoryId", () => {
  it("updates the stock", async () => {
    const whRes = await admin("post", "/api/admin/warehouses").send({ name: "Mumbai", code: "MUM" });
    const product = await seedProduct("Nova Phone", "SKU-C");
    const row = await Inventory.create({
      productId: product._id,
      variantId: product.variants[0]!._id,
      warehouseId: whRes.body.data._id,
      stock: 1,
    });

    const res = await admin("patch", `/api/admin/inventory/${row._id.toString()}`).send({ stock: 20 });

    expect(res.status).toBe(200);
    expect(res.body.data.stock).toBe(20);
  });

  it("rejects a negative stock with NEGATIVE_STOCK_REJECTED (FR-INV-005/006)", async () => {
    const whRes = await admin("post", "/api/admin/warehouses").send({ name: "Mumbai", code: "MUM" });
    const product = await seedProduct("Nova Phone", "SKU-D");
    const row = await Inventory.create({
      productId: product._id,
      variantId: product.variants[0]!._id,
      warehouseId: whRes.body.data._id,
      stock: 1,
    });

    const res = await admin("patch", `/api/admin/inventory/${row._id.toString()}`).send({ stock: -1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NEGATIVE_STOCK_REJECTED");
  });

  it("404s for a nonexistent inventory row", async () => {
    const res = await admin("patch", `/api/admin/inventory/${new Types.ObjectId().toString()}`).send({
      stock: 5,
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("INVENTORY_ROW_NOT_FOUND");
  });
});
