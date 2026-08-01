import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@/modules/products/products.repository", () => ({
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

vi.mock("@/modules/brands/brands.service", () => ({
  getBrandById: vi.fn(),
}));

vi.mock("@/modules/categories/categories.service", () => ({
  getCategoryById: vi.fn(),
}));

vi.mock("@/modules/categorySpecifications/categorySpecifications.service", () => ({
  validateProductSpecifications: vi.fn(),
}));

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

import app from "@/app";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";
import type { ProductRecord, PublicProductDoc } from "@/modules/products/products.repository";
import * as productsRepository from "@/modules/products/products.repository";
import * as brandsService from "@/modules/brands/brands.service";
import * as categoriesService from "@/modules/categories/categories.service";
import * as categorySpecificationsService from "@/modules/categorySpecifications/categorySpecifications.service";

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

const productStub: ProductRecord = {
  _id: productId,
  name: "Phone",
  slug: "phone",
  sku: "SKU-1",
  description: "A phone",
  brand: brandId,
  category: categoryId,
  images: [{ url: "https://cdn.test.example/product-image/a.png", isPrimary: true }],
  specifications: [],
  variants: [],
  mrp: 99900,
  discount: 10,
  sellingPrice: 89910,
  stock: 10,
  lowStockThreshold: 0,
  isFeatured: false,
  status: "draft",
  createdBy: null,
  updatedBy: null,
};

const validBody = {
  name: "Phone",
  description: "A phone",
  sku: "SKU-1",
  brand: brandId.toString(),
  category: categoryId.toString(),
  images: [{ objectKey: "product-image/a.png" }],
  mrp: 99900,
  discount: 10,
  stock: 10,
};

const publicProductStub: PublicProductDoc = {
  ...productStub,
  status: "published",
  brand: { _id: brandId, name: "Nova", slug: "nova" },
  category: { _id: categoryId, name: "Electronics", slug: "electronics" },
};

const variantId = new Types.ObjectId();

const existingVariant = {
  _id: variantId,
  sku: "SKU-1-RED-L",
  attributes: [
    { name: "Color", value: "Red" },
    { name: "Size", value: "L" },
  ],
  images: [],
  mrp: 51000,
  discount: 0,
  sellingPrice: 51000,
  stock: 5,
  active: true,
};

const productWithVariant: ProductRecord = { ...productStub, variants: [existingVariant] };

const addVariantBody = {
  sku: "SKU-1-BLUE-M",
  attributes: [
    { name: "Color", value: "Blue" },
    { name: "Size", value: "M" },
  ],
  mrp: 51000,
  discount: 0,
  stock: 3,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/products", () => {
  it("rejects a request with no X-Admin-Key header", async () => {
    const res = await request(app).post("/api/admin/products").send(validBody);
    expect(res.status).toBe(401);
  });

  it("creates a product and computes sellingPrice server-side", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    const res = await request(app)
      .post("/api/admin/products")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ ...validBody, sellingPrice: 1 });

    expect(res.status).toBe(201);
    expect(productsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ mrp: 99900, discount: 10, sellingPrice: 89910 }),
    );
    // sellingPrice submitted by the client has no effect (FR-CAT-087) —
    // stripped by Zod's default "unknown keys" handling before it ever
    // reaches the service.
    expect(res.body.data.sellingPrice).toBe(89910);
  });

  it("rejects a non-positive mrp with a validation error", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ ...validBody, mrp: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(productsRepository.create).not.toHaveBeenCalled();
  });

  it("rejects a discount of 100", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ ...validBody, discount: 100 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects negative stock", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ ...validBody, stock: -1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects fractional stock", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ ...validBody, stock: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a duplicate SKU", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(true);

    const res = await request(app)
      .post("/api/admin/products")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_SKU");
    expect(productsRepository.create).not.toHaveBeenCalled();
  });

  it("returns BRAND_NOT_FOUND when the brand reference doesn't exist", async () => {
    vi.mocked(brandsService.getBrandById).mockRejectedValueOnce(
      new AppError(404, "BRAND_NOT_FOUND", "not found"),
    );

    const res = await request(app)
      .post("/api/admin/products")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BRAND_NOT_FOUND");
  });

  it("returns SPECIFICATION_VALIDATION_FAILED when specs don't satisfy the category's schema", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(categorySpecificationsService.validateProductSpecifications).mockRejectedValueOnce(
      new AppError(400, "SPECIFICATION_VALIDATION_FAILED", "bad specs"),
    );

    const res = await request(app)
      .post("/api/admin/products")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SPECIFICATION_VALIDATION_FAILED");
    expect(productsRepository.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/products/:id", () => {
  it("updates a product without touching its sku", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue({
      ...productStub,
      name: "New name",
    });

    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ name: "New name", sku: "SHOULD-BE-IGNORED" });

    expect(res.status).toBe(200);
    const patch = vi.mocked(productsRepository.updateById).mock.calls[0]?.[1];
    expect(patch).not.toHaveProperty("sku");
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent id", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ name: "New name" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects a category move whose new schema the existing specs don't satisfy", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsService.validateProductSpecifications).mockRejectedValueOnce(
      new AppError(400, "SPECIFICATION_VALIDATION_FAILED", "bad specs"),
    );

    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ category: new Types.ObjectId().toString() });

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

    const res = await request(app)
      .get(`/api/admin/products/${productId.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("archived");
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent id", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/admin/products/${productId.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY);

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

    const res = await request(app).get("/api/admin/products").set("X-Admin-Key", env.ADMIN_API_KEY);

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
    const res = await request(app)
      .get("/api/admin/products?limit=1000")
      .set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("passes the parsed sort field/order through to the repository", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await request(app).get("/api/admin/products?sort=-mrp").set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { lowStock: false },
      { field: "mrp", order: -1 },
      { page: 1, limit: 20 },
    );
  });

  it("passes the search term through to the repository", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await request(app)
      .get("/api/admin/products?search=SKU-1")
      .set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { lowStock: false, search: "SKU-1", status: undefined },
      { field: "createdAt", order: -1 },
      { page: 1, limit: 20 },
    );
  });

  it("composes search with a status filter without narrowing either incorrectly", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await request(app)
      .get("/api/admin/products?search=phone&status=published")
      .set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { lowStock: false, search: "phone", status: "published" },
      { field: "createdAt", order: -1 },
      { page: 1, limit: 20 },
    );
  });

  it("rejects an unrecognized status filter value", async () => {
    const res = await request(app)
      .get("/api/admin/products?status=deleted")
      .set("X-Admin-Key", env.ADMIN_API_KEY);

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

    const res = await request(app)
      .delete(`/api/admin/products/${productId.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, { status: "archived" });
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent id", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/admin/products/${productId.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });
});

describe("PATCH /api/admin/products/:id/stock", () => {
  it("adjusts stock without requiring any other field", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue({ ...productStub, stock: 42 });

    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}/stock`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ stock: 42 });

    expect(res.status).toBe(200);
    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, { stock: 42 });
  });

  it("rejects negative stock", async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}/stock`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ stock: -1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /api/admin/products/:id/status", () => {
  it("rejects a request with no X-Admin-Key header", async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}/status`)
      .send({ status: "published" });
    expect(res.status).toBe(401);
  });

  it("sets the requested status", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue({
      ...productStub,
      status: "published",
    });

    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}/status`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ status: "published" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("published");
    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, { status: "published" });
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent id", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}/status`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ status: "published" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects an unrecognized status value", async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${productId.toString()}/status`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ status: "deleted" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/admin/products/:id/variants", () => {
  it("rejects a request with no X-Admin-Key header", async () => {
    const res = await request(app)
      .post(`/api/admin/products/${productId.toString()}/variants`)
      .send(addVariantBody);
    expect(res.status).toBe(401);
  });

  it("adds a variant with a server-computed sellingPrice", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariant);

    const res = await request(app)
      .post(`/api/admin/products/${productId.toString()}/variants`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ ...addVariantBody, mrp: 60000, discount: 10 });

    expect(res.status).toBe(201);
    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted?.[1]).toMatchObject({
      sku: "SKU-1-BLUE-M",
      active: true,
      sellingPrice: 54000,
    });
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/admin/products/${productId.toString()}/variants`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send(addVariantBody);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects a variant sku already used by a sibling variant", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);

    const res = await request(app)
      .post(`/api/admin/products/${productId.toString()}/variants`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ ...addVariantBody, sku: existingVariant.sku });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_SKU");
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("rejects an attribute combination duplicating an existing variant's, regardless of order", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);

    const res = await request(app)
      .post(`/api/admin/products/${productId.toString()}/variants`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({
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
    const res = await request(app)
      .post(`/api/admin/products/${productId.toString()}/variants`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ ...addVariantBody, mrp: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an empty attributes array", async () => {
    const res = await request(app)
      .post(`/api/admin/products/${productId.toString()}/variants`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ ...addVariantBody, attributes: [] });

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

    const res = await request(app)
      .patch(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ active: false });

    expect(res.status).toBe(200);
    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted).toHaveLength(1);
    expect(persisted?.[0]).toMatchObject({ _id: variantId, active: false });
    expect(res.body.data.variants[0].active).toBe(false);
  });

  it("returns VARIANT_NOT_FOUND for a variantId that isn't on this product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariant);

    const res = await request(app)
      .patch(
        `/api/admin/products/${productId.toString()}/variants/${new Types.ObjectId().toString()}`,
      )
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ stock: 1 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VARIANT_NOT_FOUND");
  });

  it("returns PRODUCT_NOT_FOUND for a nonexistent product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    const res = await request(app)
      .patch(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ stock: 1 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects negative stock", async () => {
    const res = await request(app)
      .patch(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ stock: -1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/products", () => {
  it("requires no admin key and returns a paginated envelope", async () => {
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

    for (const field of ["stock", "lowStockThreshold", "status", "createdBy", "updatedBy"]) {
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
    expect(productsRepository.listPublicPaginated).toHaveBeenCalledWith(
      {},
      { page: 1, limit: 48 },
    );
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
      { page: 1, limit: 24 },
    );
    expect(productsRepository.listPublicPaginated).not.toHaveBeenCalled();
  });
});

describe("GET /api/products/:slug", () => {
  it("requires no admin key and returns the full detail shape", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue(publicProductStub);

    const res = await request(app).get("/api/products/phone");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      _id: productId.toString(),
      name: "Phone",
      slug: "phone",
      sku: "SKU-1",
      brand: { _id: brandId.toString(), name: "Nova", slug: "nova" },
      category: { _id: categoryId.toString(), name: "Electronics", slug: "electronics" },
      hasVariants: false,
    });
  });

  it("strips every admin-only field from the detail response", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue(publicProductStub);

    const res = await request(app).get("/api/products/phone");

    for (const field of ["stock", "lowStockThreshold", "status", "createdBy", "updatedBy"]) {
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
