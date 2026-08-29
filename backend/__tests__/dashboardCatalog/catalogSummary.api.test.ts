import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import request from "supertest";

// Issue #172/M7.2 — real DB (the role boundary and live count math are the
// actual behavior under test).
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import { Category } from "@/modules/product-catalog/features/categories/categories.model";
import { Brand } from "@/modules/product-catalog/features/brands/brands.model";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../testHelpers/adminSession";

const CATALOG_MANAGER_EMAIL = "catalog-summary-catalog-manager@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";
const ORDER_MANAGER_EMAIL = "catalog-summary-order-manager@example.com";
const ORDER_MANAGER_PASSWORD = "OrderMgr!Pass1";

let ctx: MemoryMongoContext;
let app: Express;
let catalogManagerToken: string;
let orderManagerToken: string;

async function createProduct(status: "draft" | "published" | "archived"): Promise<void> {
  // A real variant with a genuinely unique sku, not an empty array — the
  // unique index on variants.sku indexes an empty array as a null entry, so
  // two products both passing variants: [] collide with each other there.
  await Product.create({
    name: `Fixture ${status} ${new Types.ObjectId().toString()}`,
    slug: `fixture-${status}-${new Types.ObjectId().toString()}`,
    description: "A fixture product.",
    brand: new Types.ObjectId(),
    category: new Types.ObjectId(),
    specifications: [],
    isFeatured: false,
    status,
    variants: [
      {
        sku: `SKU-${new Types.ObjectId().toString()}`,
        attributes: [{ name: "Color", value: "Black" }],
        images: [{ url: "https://cdn.test/a.webp", alt: "A", isPrimary: true }],
        mrp: 1000,
        discount: 0,
        sellingPrice: 1000,
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
    name: "Catalog Manager Fixture",
    role: "catalog-manager",
  });
  catalogManagerToken = await signInFully(app, CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);

  await provisionAdminUser({
    email: ORDER_MANAGER_EMAIL,
    password: ORDER_MANAGER_PASSWORD,
    name: "Order Manager Fixture",
    role: "order-manager",
  });
  orderManagerToken = await signInFully(app, ORDER_MANAGER_EMAIL, ORDER_MANAGER_PASSWORD);
}, 90000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Category.deleteMany({});
  await Brand.deleteMany({});
  const { resetDashboardCache } = await import("../../src/lib/cache.js");
  resetDashboardCache();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/dashboard/catalog-summary (FR-DASH-007/020/021)", () => {
  it("rejects an order-manager session 403", async () => {
    const res = await authRequest(
      app,
      "get",
      "/api/admin/dashboard/catalog-summary",
      orderManagerToken,
    );
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("401s with no session", async () => {
    const res = await request(app).get("/api/admin/dashboard/catalog-summary");
    expect(res.status).toBe(401);
  });

  it("reports live counts with no outOfStockCount field", async () => {
    await createProduct("draft");
    await createProduct("published");
    await createProduct("published");
    await createProduct("archived");
    await Category.create([
      { name: "Cat A", slug: `cat-a-${new Types.ObjectId().toString()}`, status: true },
      { name: "Cat B", slug: `cat-b-${new Types.ObjectId().toString()}`, status: false },
    ]);
    await Brand.create([
      { name: "Brand A", slug: `brand-a-${new Types.ObjectId().toString()}`, status: true },
    ]);

    const res = await authRequest(
      app,
      "get",
      "/api/admin/dashboard/catalog-summary",
      catalogManagerToken,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.totalProducts).toBe(4);
    expect(res.body.data.productsByStatus).toMatchObject({
      draft: 1,
      published: 2,
      archived: 1,
    });
    expect(res.body.data.totalCategories).toBe(2);
    expect(res.body.data.activeCategories).toBe(1);
    expect(res.body.data.totalBrands).toBe(1);
    expect(res.body.data.activeBrands).toBe(1);
    expect(res.body.data).not.toHaveProperty("outOfStockCount");
  });
});
