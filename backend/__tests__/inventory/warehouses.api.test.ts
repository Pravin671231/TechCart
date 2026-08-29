import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Issue #189/M10.1 — warehouses/inventory routes are rbac(CATALOG_ADMIN_ROLES)
// guarded, needing a real session (the adminSession.ts harness). Unlike the
// brands/categories admin suites, this one runs fully against a real DB —
// FR-INV-002's row-backfill is the actual behavior under test, and it can
// only be verified against real Product/Warehouse/Inventory documents.
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

const CATALOG_MANAGER_EMAIL = "warehouses-catalog-manager@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;

async function seedProduct() {
  return Product.create({
    name: "Warehouse Test Phone",
    slug: `warehouse-test-${new Types.ObjectId().toString()}`,
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
    name: "Warehouses Catalog Manager Fixture",
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

describe("auth gating", () => {
  it("rejects with no session", async () => {
    const res = await request(app).get("/api/admin/warehouses");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/admin/warehouses", () => {
  it("creates a warehouse, always active", async () => {
    const res = await admin("post", "/api/admin/warehouses").send({
      name: "Mumbai Warehouse",
      code: "MUM",
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Mumbai Warehouse", code: "MUM", active: true });
  });

  it("rejects a duplicate code", async () => {
    await admin("post", "/api/admin/warehouses").send({ name: "Mumbai", code: "MUM" });

    const res = await admin("post", "/api/admin/warehouses").send({ name: "Mumbai 2", code: "MUM" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_WAREHOUSE_CODE");
  });

  it("backfills a stock:0 row for every existing variant across every product (FR-INV-002)", async () => {
    const productA = await seedProduct();
    const productB = await seedProduct();

    const res = await admin("post", "/api/admin/warehouses").send({
      name: "Delhi Warehouse",
      code: "DEL",
    });
    const warehouseId = res.body.data._id;

    const rows = await Inventory.find({ warehouseId }).lean();
    expect(rows).toHaveLength(2);
    const variantIds = rows.map((row) => row.variantId.toString());
    expect(variantIds).toContain(productA.variants[0]!._id.toString());
    expect(variantIds).toContain(productB.variants[0]!._id.toString());
    expect(rows.every((row) => row.stock === 0)).toBe(true);
  });
});

describe("GET /api/admin/warehouses", () => {
  it("lists every warehouse, unpaginated", async () => {
    await admin("post", "/api/admin/warehouses").send({ name: "Mumbai", code: "MUM" });
    await admin("post", "/api/admin/warehouses").send({ name: "Delhi", code: "DEL" });

    const res = await admin("get", "/api/admin/warehouses");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body).not.toHaveProperty("pagination");
  });
});

describe("addVariant backfill (FR-INV-002)", () => {
  it("gives a new variant a stock:0 row for every active warehouse", async () => {
    const whRes = await admin("post", "/api/admin/warehouses").send({ name: "Mumbai", code: "MUM" });
    const warehouseId = whRes.body.data._id;
    const product = await seedProduct();

    const addRes = await admin("post", `/api/admin/products/${product._id.toString()}/variants`).send({
      sku: `SKU-NEW-${new Types.ObjectId().toString()}`,
      attributes: [{ name: "Color", value: "Blue" }],
      images: [{ url: "https://cdn.test/b.webp", alt: "B", isPrimary: true }],
      mrp: 12000,
      discount: 0,
    });

    expect(addRes.status).toBe(200);
    const newVariant = addRes.body.data.variants[addRes.body.data.variants.length - 1];

    const row = await Inventory.findOne({ variantId: newVariant._id, warehouseId }).lean();
    expect(row).toMatchObject({ stock: 0 });
  });
});
