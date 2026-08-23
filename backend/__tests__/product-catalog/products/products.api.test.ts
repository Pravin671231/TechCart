import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Issue #143/M3.5 — every /api/admin/products route is now gated by
// rbac.ts, which needs a real Better Auth session to resolve, not the old
// X-Admin-Key header — see brands.api.test.ts's own header comment for the
// full rationale. Public /api/products* routes are untouched, no session
// needed.
vi.mock("@/externalService/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/product-catalog/features/products/products.repository", () => ({
  PRODUCT_SORT_FIELDS: ["createdAt", "name"],
  create: vi.fn(),
  findById: vi.fn(),
  slugExists: vi.fn(),
  skuInUse: vi.fn(),
  updateById: vi.fn(),
  replaceVariants: vi.fn(),
  listPaginated: vi.fn(),
  findPublishedBySlug: vi.fn(),
  listPublicPaginated: vi.fn(),
  searchPublicPaginated: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/brands/brands.service", () => ({
  getBrandById: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/categories/categories.service", () => ({
  getCategoryById: vi.fn(),
  getActiveCategoryBySlug: vi.fn(),
  listActiveSubcategoryIds: vi.fn(),
}));

vi.mock(
  "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.service",
  () => ({
    validateProductSpecifications: vi.fn(),
    getCardFieldsByCategoryIds: vi.fn().mockResolvedValue(new Map()),
    getFilterableFieldsByCategory: vi.fn().mockResolvedValue(new Map()),
  }),
);

// Partial mock via importOriginal — the real app boots uploads.routes.ts too
// (mounted under the same adminRouter), which reads UPLOAD_PURPOSES/
// ALLOWED_CONTENT_TYPES off this module at import time; a full replacement
// mock would leave those undefined and crash route registration.
vi.mock("@/modules/uploads/uploads.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/uploads/uploads.service")>();
  return {
    ...actual,
    consumeImageKeys: vi.fn(),
    validateImageCount: vi.fn(),
    normalizeImages: vi.fn((images: { isPrimary?: boolean }[]) =>
      images.map((image, index) => ({ ...image, isPrimary: index === 0 })),
    ),
    buildPublicUrl: vi.fn((objectKey: string) => `https://cdn.test.example/${objectKey}`),
  };
});

import { AppError } from "@/utils/AppError";
import type {
  ProductRecord,
  PublicProductDoc,
} from "@/modules/product-catalog/features/products/products.repository";
import * as productsRepository from "@/modules/product-catalog/features/products/products.repository";
import * as brandsService from "@/modules/product-catalog/features/brands/brands.service";
import * as categoriesService from "@/modules/product-catalog/features/categories/categories.service";
import * as categorySpecificationsService from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.service";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const CATALOG_MANAGER_EMAIL = "products-catalog-manager@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";
const ORDER_MANAGER_EMAIL = "products-order-manager@example.com";
const ORDER_MANAGER_PASSWORD = "OrderMgr!Pass1";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;
let orderManagerToken: string;
let catalogManagerId: string;

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;

  const { provisionAdminUser } = await import("../../../src/scripts/seed/createAdminUser.js");
  await provisionAdminUser({
    email: CATALOG_MANAGER_EMAIL,
    password: CATALOG_MANAGER_PASSWORD,
    name: "Products Catalog Manager Fixture",
    role: "catalog-manager",
  });
  token = await signInFully(app, CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);

  const catalogManagerDoc = await ctx.mongoose.connection
    .db!.collection<{ _id: unknown; email: string }>("users")
    .findOne({ email: CATALOG_MANAGER_EMAIL });
  catalogManagerId = String(catalogManagerDoc!._id);

  await provisionAdminUser({
    email: ORDER_MANAGER_EMAIL,
    password: ORDER_MANAGER_PASSWORD,
    name: "Products Order Manager Fixture",
    role: "order-manager",
  });
  orderManagerToken = await signInFully(app, ORDER_MANAGER_EMAIL, ORDER_MANAGER_PASSWORD);
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

function admin(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, token);
}

const productId = new Types.ObjectId();
const brandId = new Types.ObjectId();
const categoryId = new Types.ObjectId();

const brandStub = {
  _id: brandId,
  name: "Nova",
  slug: "nova",
  status: true,
  createdBy: null,
  updatedBy: null,
};

const categoryStub = {
  _id: categoryId,
  name: "Electronics",
  slug: "electronics",
  parentCategory: null,
  sortOrder: 0,
  status: true,
  createdBy: null,
  updatedBy: null,
};

// Issue #102: sku/images/mrp/discount/sellingPrice/stock/lowStockThreshold
// are gone from the product — every sellable, priced, imaged field lives
// only on a variant now.
const productStub: ProductRecord = {
  _id: productId,
  name: "Phone",
  slug: "phone",
  description: "A phone",
  brand: brandId,
  category: categoryId,
  specifications: [],
  variants: [],
  isFeatured: false,
  status: "draft",
  createdBy: null,
  updatedBy: null,
};

const validBody = {
  name: "Phone",
  description: "A phone",
  brand: brandId.toString(),
  category: categoryId.toString(),
};

const publicProductStub: PublicProductDoc = {
  ...productStub,
  status: "published",
  brand: { _id: brandId, name: "Nova", slug: "nova" },
  category: { _id: categoryId, name: "Electronics", slug: "electronics" },
};

const variantId = new Types.ObjectId();

// images is required (1-2), not optional/empty-default, since #102 removed
// the parent product's own images fallback.
const existingVariant = {
  _id: variantId,
  sku: "SKU-1-RED-L",
  attributes: [
    { name: "Color", value: "Red" },
    { name: "Size", value: "L" },
  ],
  images: [{ url: "https://cdn.test.example/product-image/red-l.png", isPrimary: true }],
  mrp: 51000,
  discount: 0,
  sellingPrice: 51000,
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const productWithVariant: ProductRecord = { ...productStub, variants: [existingVariant] };

const addVariantBody = {
  sku: "SKU-1-BLUE-M",
  attributes: [
    { name: "Color", value: "Blue" },
    { name: "Size", value: "M" },
  ],
  images: [{ objectKey: "product-image/blue-m.png" }],
  mrp: 51000,
  discount: 0,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/products", () => {
  it("rejects a request with no session at all", async () => {
    const res = await request(app).post("/api/admin/products").send(validBody);
    expect(res.status).toBe(401);
  });

  it("rejects a session with the wrong role (order-manager)", async () => {
    const res = await authRequest(app, "post", "/api/admin/products", orderManagerToken).send(
      validBody,
    );
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("creates a product with just metadata, ignoring unknown fields like sku/mrp/stock", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    const res = await admin("post", "/api/admin/products").send({
      ...validBody,
      sku: "IGNORED",
      mrp: 99900,
      stock: 10,
      images: [{ objectKey: "x" }],
    });

    expect(res.status).toBe(201);
    const doc = vi.mocked(productsRepository.create).mock.calls[0]?.[0];
    for (const field of [
      "sku",
      "images",
      "mrp",
      "discount",
      "sellingPrice",
      "stock",
      "lowStockThreshold",
    ]) {
      expect(doc).not.toHaveProperty(field);
    }
  });

  it("stores the signed-in catalog-manager's real user id in createdBy", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    await admin("post", "/api/admin/products").send(validBody);

    const doc = vi.mocked(productsRepository.create).mock.calls[0]?.[0];
    expect(doc?.createdBy?.toString()).toBe(catalogManagerId);
  });

  it("rejects a request missing a required field", async () => {
    const { category: _category, ...withoutCategory } = validBody;

    const res = await admin("post", "/api/admin/products").send(withoutCategory);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(productsRepository.create).not.toHaveBeenCalled();
  });

  it("returns BRAND_NOT_FOUND when the brand reference doesn't exist", async () => {
    vi.mocked(brandsService.getBrandById).mockRejectedValueOnce(
      new AppError(404, "BRAND_NOT_FOUND", "not found"),
    );

    const res = await admin("post", "/api/admin/products").send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BRAND_NOT_FOUND");
  });

  it("returns SPECIFICATION_VALIDATION_FAILED when specs don't satisfy the category's schema", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsService.validateProductSpecifications).mockRejectedValueOnce(
      new AppError(400, "SPECIFICATION_VALIDATION_FAILED", "bad specs"),
    );

    const res = await admin("post", "/api/admin/products").send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SPECIFICATION_VALIDATION_FAILED");
    expect(productsRepository.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/products/:id", () => {
  it("ignores unknown fields like sku/mrp/stock submitted in the body", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue({
      ...productStub,
      name: "New name",
    });

    const res = await admin("patch", `/api/admin/products/${productId.toString()}`).send({
      name: "New name",
      sku: "SHOULD-BE-IGNORED",
      mrp: 1,
      stock: 1,
    });

    expect(res.status).toBe(200);
    const patch = vi.mocked(productsRepository.updateById).mock.calls[0]?.[1];
    for (const field of [
      "sku",
      "mrp",
      "discount",
      "sellingPrice",
      "stock",
      "lowStockThreshold",
      "images",
    ]) {
      expect(patch).not.toHaveProperty(field);
    }
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent id", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    const res = await admin("patch", `/api/admin/products/${productId.toString()}`).send({
      name: "New name",
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects a category move whose new schema the existing specs don't satisfy", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsService.validateProductSpecifications).mockRejectedValueOnce(
      new AppError(400, "SPECIFICATION_VALIDATION_FAILED", "bad specs"),
    );

    const res = await admin("patch", `/api/admin/products/${productId.toString()}`).send({
      category: new Types.ObjectId().toString(),
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SPECIFICATION_VALIDATION_FAILED");
    expect(productsRepository.updateById).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/products/:id", () => {
  it("returns the product at any status", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue({
      ...productStub,
      status: "archived",
    });

    const res = await admin("get", `/api/admin/products/${productId.toString()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("archived");
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent id", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    const res = await admin("get", `/api/admin/products/${productId.toString()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });
});

describe("GET /api/admin/products", () => {
  it("returns a paginated envelope", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({
      items: [productStub],
      total: 1,
    });

    const res = await admin("get", "/api/admin/products");

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
    });
  });

  it("clamps an oversized limit request", async () => {
    const res = await admin("get", "/api/admin/products?limit=1000");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  // mrp/stock sort options were removed with #102 — the product no longer
  // has either field; name/createdAt remain. Issue #104: sort is now
  // ?sortBy=&orderBy= instead of a combined ?sort=-field enum.
  it("passes the parsed sort field/order through to the repository", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await admin("get", "/api/admin/products?sortBy=name&orderBy=desc");

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      {},
      { field: "name", order: -1 },
      { page: 1, limit: 20 },
    );
  });

  it("passes sort: undefined to the repository when orderBy is none", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await admin("get", "/api/admin/products?orderBy=none");

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      {},
      undefined,
      { page: 1, limit: 20 },
    );
  });

  it("rejects an unrecognized sortBy value", async () => {
    const res = await admin("get", "/api/admin/products?sortBy=badfield");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an unrecognized orderBy value", async () => {
    const res = await admin("get", "/api/admin/products?orderBy=sideways");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("passes the search term through to the repository", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await admin("get", "/api/admin/products?search=SKU-1");

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { search: "SKU-1", status: undefined },
      { field: "createdAt", order: -1 },
      { page: 1, limit: 20 },
    );
  });

  it("composes search with a status filter without narrowing either incorrectly", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await admin("get", "/api/admin/products?search=phone&status=published");

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { search: "phone", status: "published" },
      { field: "createdAt", order: -1 },
      { page: 1, limit: 20 },
    );
  });

  it("rejects an unrecognized status filter value", async () => {
    const res = await admin("get", "/api/admin/products?status=deleted");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /api/admin/products/:id", () => {
  it("soft-deletes, leaving the document present with status: archived", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue({
      ...productStub,
      status: "archived",
    });

    const res = await admin("delete", `/api/admin/products/${productId.toString()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, {
      status: "archived",
      updatedBy: expect.any(Types.ObjectId),
    });
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent id", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue(null);

    const res = await admin("delete", `/api/admin/products/${productId.toString()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });
});

describe("PATCH /api/admin/products/:id/status", () => {
  it("rejects a request with no session at all", async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}/status`)
      .send({ status: "published" });
    expect(res.status).toBe(401);
  });

  // FR-CAT-043 (#102): publishing requires at least one active variant.
  it("publishes when the product has an active variant", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);
    vi.mocked(productsRepository.updateById).mockResolvedValue({
      ...productWithVariant,
      status: "published",
    });

    const res = await admin(
      "patch",
      `/api/admin/products/${productId.toString()}/status`,
    ).send({ status: "published" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("published");
    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, {
      status: "published",
      updatedBy: expect.any(Types.ObjectId),
    });
  });

  it("rejects publishing a product with zero variants with PRODUCT_HAS_NO_VARIANTS", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);

    const res = await admin(
      "patch",
      `/api/admin/products/${productId.toString()}/status`,
    ).send({ status: "published" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PRODUCT_HAS_NO_VARIANTS");
    expect(productsRepository.updateById).not.toHaveBeenCalled();
  });

  it("sets a non-publish status without checking variants", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue({
      ...productStub,
      status: "archived",
    });

    const res = await admin(
      "patch",
      `/api/admin/products/${productId.toString()}/status`,
    ).send({ status: "archived" });

    expect(res.status).toBe(200);
    expect(productsRepository.findById).not.toHaveBeenCalled();
    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, {
      status: "archived",
      updatedBy: expect.any(Types.ObjectId),
    });
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent id when publishing", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    const res = await admin(
      "patch",
      `/api/admin/products/${productId.toString()}/status`,
    ).send({ status: "published" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects an unrecognized status value", async () => {
    const res = await admin(
      "patch",
      `/api/admin/products/${productId.toString()}/status`,
    ).send({ status: "deleted" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/admin/products/:id/variants", () => {
  it("rejects a request with no session at all", async () => {
    const res = await request(app)
      .post(`/api/admin/products/${productId.toString()}/variants`)
      .send(addVariantBody);
    expect(res.status).toBe(401);
  });

  it("adds a variant with a server-computed sellingPrice", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariant);

    const res = await admin(
      "post",
      `/api/admin/products/${productId.toString()}/variants`,
    ).send({ ...addVariantBody, mrp: 60000, discount: 10 });

    expect(res.status).toBe(201);
    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted?.[1]).toMatchObject({
      sku: "SKU-1-BLUE-M",
      active: true,
      sellingPrice: 54000,
    });
    expect(persisted?.[1]).not.toHaveProperty("stock");
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    const res = await admin(
      "post",
      `/api/admin/products/${productId.toString()}/variants`,
    ).send(addVariantBody);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects a variant sku already used by a sibling variant", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);

    const res = await admin(
      "post",
      `/api/admin/products/${productId.toString()}/variants`,
    ).send({ ...addVariantBody, sku: existingVariant.sku });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_SKU");
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("rejects an attribute combination duplicating an existing variant's, regardless of order", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);

    const res = await admin("post", `/api/admin/products/${productId.toString()}/variants`).send({
      ...addVariantBody,
      sku: "SKU-1-UNIQUE",
      attributes: [
        { name: "Size", value: "L" },
        { name: "Color", value: "Red" },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_VARIANT_ATTRIBUTES");
  });

  it("rejects a non-positive mrp with a validation error", async () => {
    const res = await admin(
      "post",
      `/api/admin/products/${productId.toString()}/variants`,
    ).send({ ...addVariantBody, mrp: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an empty attributes array", async () => {
    const res = await admin(
      "post",
      `/api/admin/products/${productId.toString()}/variants`,
    ).send({ ...addVariantBody, attributes: [] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a request missing images — required since #102 removed the parent product's fallback", async () => {
    const { images: _images, ...withoutImages } = addVariantBody;

    const res = await admin(
      "post",
      `/api/admin/products/${productId.toString()}/variants`,
    ).send(withoutImages);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /api/admin/products/:id/variants/:variantId", () => {
  const url = `/api/admin/products/${productId.toString()}/variants/${variantId.toString()}`;

  it("deactivates a variant, leaving it embedded rather than removed", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue({
      ...productWithVariant,
      variants: [{ ...existingVariant, active: false }],
    });

    const res = await admin("patch", url).send({ active: false });

    expect(res.status).toBe(200);
    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted).toHaveLength(1);
    expect(persisted?.[0]).toMatchObject({ _id: variantId, active: false });
    expect(res.body.data.variants[0].active).toBe(false);
  });

  it("returns VARIANT_NOT_FOUND for a variantId that isn't on this product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);

    const res = await admin(
      "patch",
      `/api/admin/products/${productId.toString()}/variants/${new Types.ObjectId().toString()}`,
    ).send({ weight: 1 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VARIANT_NOT_FOUND");
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    const res = await admin("patch", url).send({ weight: 1 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects a non-positive mrp when mrp is provided", async () => {
    const res = await admin("patch", url).send({ mrp: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/products", () => {
  it("requires no session and returns a paginated envelope", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [publicProductStub],
      total: 1,
    });

    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 24,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
    });
    expect(res.body.data[0]).toMatchObject({
      _id: productId.toString(),
      name: "Phone",
      slug: "phone",
      brand: { _id: brandId.toString(), name: "Nova", slug: "nova" },
    });
  });

  it("strips every admin-only field from each list item", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [publicProductStub],
      total: 1,
    });

    const res = await request(app).get("/api/products");

    for (const field of ["status", "createdBy", "updatedBy"]) {
      expect(res.body.data[0]).not.toHaveProperty(field);
    }
  });

  it("returns a successful empty response for no matches, not an error", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("clamps an oversized limit rather than rejecting it", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    const res = await request(app).get("/api/products?limit=1000");

    expect(res.status).toBe(200);
    expect(productsRepository.listPublicPaginated).toHaveBeenCalledWith({}, "newest", {
      page: 1,
      limit: 48,
    });
  });

  it("uses Atlas Search when q is present", async () => {
    vi.mocked(productsRepository.searchPublicPaginated).mockResolvedValue({
      items: [publicProductStub],
      total: 1,
    });

    const res = await request(app).get("/api/products?q=phone");

    expect(res.status).toBe(200);
    expect(productsRepository.searchPublicPaginated).toHaveBeenCalledWith(
      "phone",
      {},
      "relevance",
      { page: 1, limit: 24 },
    );
    expect(productsRepository.listPublicPaginated).not.toHaveBeenCalled();
  });

  it("filters by price range, brand, and on-sale, all composed together", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({ items: [], total: 0 });
    const otherBrandId = new Types.ObjectId();

    const res = await request(app).get(
      `/api/products?minPrice=1000&maxPrice=5000&brand=${brandId.toString()},${otherBrandId.toString()}&onSale=true&sort=price_asc`,
    );

    expect(res.status).toBe(200);
    expect(productsRepository.listPublicPaginated).toHaveBeenCalledWith(
      {
        brandIds: [brandId, otherBrandId],
        minPrice: 1000,
        maxPrice: 5000,
        onSaleOnly: true,
      },
      "price_asc",
      { page: 1, limit: 24 },
    );
  });

  it("resolves ?category= to the active category plus its subcategories", async () => {
    const subcategoryId = new Types.ObjectId();
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue({
      _id: categoryId,
      name: "Electronics",
      slug: "electronics",
      parentCategory: null,
      sortOrder: 0,
      status: true,
      createdBy: null,
      updatedBy: null,
    });
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([subcategoryId]);
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    const res = await request(app).get("/api/products?category=electronics");

    expect(res.status).toBe(200);
    expect(productsRepository.listPublicPaginated).toHaveBeenCalledWith(
      { categoryIds: [categoryId, subcategoryId] },
      "newest",
      { page: 1, limit: 24 },
    );
  });

  it("routes a variant-attribute filter through Atlas Search even with no q", async () => {
    vi.mocked(productsRepository.searchPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    const res = await request(app).get("/api/products?attributeName=Color&attributeValue=Red");

    expect(res.status).toBe(200);
    expect(productsRepository.searchPublicPaginated).toHaveBeenCalledWith(
      undefined,
      { variantAttribute: { name: "Color", value: "Red" } },
      "newest",
      { page: 1, limit: 24 },
    );
    expect(productsRepository.listPublicPaginated).not.toHaveBeenCalled();
  });

  it("rejects attributeName submitted without attributeValue", async () => {
    const res = await request(app).get("/api/products?attributeName=Color");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid brand id", async () => {
    const res = await request(app).get("/api/products?brand=not-an-id");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("parses a bracket-notation spec value filter and routes it through Atlas Search", async () => {
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue({
      _id: categoryId,
      name: "Electronics",
      slug: "electronics",
      parentCategory: null,
      sortOrder: 0,
      status: true,
      createdBy: null,
      updatedBy: null,
    });
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([]);
    vi.mocked(categorySpecificationsService.getFilterableFieldsByCategory).mockResolvedValue(
      new Map([
        ["RAM", { name: "RAM", type: "enum", options: ["8GB"], required: false, filterable: true }],
      ]),
    );
    vi.mocked(productsRepository.searchPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    const res = await request(app).get("/api/products?category=electronics&spec[RAM]=8GB");

    expect(res.status).toBe(200);
    expect(productsRepository.searchPublicPaginated).toHaveBeenCalledWith(
      undefined,
      { categoryIds: [categoryId], specFilters: [{ name: "RAM", kind: "value", value: "8GB" }] },
      "newest",
      { page: 1, limit: 24 },
    );
  });

  it("parses a bracket-notation spec range filter", async () => {
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue({
      _id: categoryId,
      name: "Electronics",
      slug: "electronics",
      parentCategory: null,
      sortOrder: 0,
      status: true,
      createdBy: null,
      updatedBy: null,
    });
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([]);
    vi.mocked(categorySpecificationsService.getFilterableFieldsByCategory).mockResolvedValue(
      new Map([
        ["ScreenSize", { name: "ScreenSize", type: "number", required: false, filterable: true }],
      ]),
    );
    vi.mocked(productsRepository.searchPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    const res = await request(app).get(
      "/api/products?category=electronics&spec[ScreenSize][min]=6&spec[ScreenSize][max]=6.5",
    );

    expect(res.status).toBe(200);
    expect(productsRepository.searchPublicPaginated).toHaveBeenCalledWith(
      undefined,
      {
        categoryIds: [categoryId],
        specFilters: [{ name: "ScreenSize", kind: "range", min: 6, max: 6.5 }],
      },
      "newest",
      { page: 1, limit: 24 },
    );
  });

  it("returns INVALID_SPECIFICATION_FILTER for a spec filter on a non-filterable field", async () => {
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue({
      _id: categoryId,
      name: "Electronics",
      slug: "electronics",
      parentCategory: null,
      sortOrder: 0,
      status: true,
      createdBy: null,
      updatedBy: null,
    });
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([]);
    vi.mocked(categorySpecificationsService.getFilterableFieldsByCategory).mockResolvedValue(
      new Map(),
    );

    const res = await request(app).get("/api/products?category=electronics&spec[Resolution]=1080p");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_SPECIFICATION_FILTER");
  });

  it("includes cardSpecifications on each list item", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [
        {
          ...publicProductStub,
          specifications: [{ groupName: "Display", values: [{ name: "Screen Size", value: 6.1 }] }],
        },
      ],
      total: 1,
    });
    vi.mocked(categorySpecificationsService.getCardFieldsByCategoryIds).mockResolvedValue(
      new Map([[categoryId.toString(), [{ name: "Screen Size", unit: "inch" }]]]),
    );

    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body.data[0].cardSpecifications).toEqual([
      { name: "Screen Size", value: 6.1, unit: "inch" },
    ]);
  });
});

describe("GET /api/products/:slug", () => {
  it("requires no session and returns the full detail shape", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue(publicProductStub);

    const res = await request(app).get("/api/products/phone");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      _id: productId.toString(),
      name: "Phone",
      slug: "phone",
      brand: { _id: brandId.toString(), name: "Nova", slug: "nova" },
      category: { _id: categoryId.toString(), name: "Electronics", slug: "electronics" },
      hasVariants: false,
    });
  });

  it("strips every admin-only field from the detail response", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue(publicProductStub);

    const res = await request(app).get("/api/products/phone");

    for (const field of ["status", "createdBy", "updatedBy"]) {
      expect(res.body.data).not.toHaveProperty(field);
    }
  });

  it("returns PRODUCT_NOT_FOUND for a slug that doesn't match any published product", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue(null);

    const res = await request(app).get("/api/products/missing");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("returns PRODUCT_NOT_FOUND for a draft/archived product's slug (findPublishedBySlug filters status itself)", async () => {
    // findPublishedBySlug's own query already bakes in status:"published", so
    // the repository correctly returns null for a draft/archived product's
    // slug — this asserts the resulting 404 reaches the buyer indistinguishably
    // from a slug that was never assigned (FR-CAT-060).
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue(null);

    const res = await request(app).get("/api/products/draft-product");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });
});
