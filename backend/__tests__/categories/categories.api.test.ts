import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@/modules/categories/categories.repository", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  slugExists: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  list: vi.fn(),
  listActive: vi.fn(),
  countByParent: vi.fn(),
}));

vi.mock("@/modules/products/products.repository", () => ({
  countByBrand: vi.fn(),
  countByBrandIds: vi.fn(),
  countByCategory: vi.fn(),
  countByCategoryIds: vi.fn(),
}));

vi.mock("@/modules/uploads/uploads.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/uploads/uploads.service")>();
  return {
    ...actual,
    consumeImageKeys: vi.fn(),
    buildPublicUrl: vi.fn((objectKey: string) => `https://cdn.test.example/${objectKey}`),
  };
});

import app from "@/app";
import { env } from "@/config/env";
import * as categoriesRepository from "@/modules/categories/categories.repository";
import * as productsRepository from "@/modules/products/products.repository";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/categories", () => {
  it("creates a category and auto-generates a slug", async () => {
    vi.mocked(categoriesRepository.slugExists).mockResolvedValue(false);
    const id = new Types.ObjectId();
    vi.mocked(categoriesRepository.create).mockImplementation(async (doc) => ({
      _id: id,
      sortOrder: 0,
      status: true,
      createdBy: null,
      updatedBy: null,
      ...doc,
    }));

    const res = await request(app)
      .post("/api/admin/categories")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ name: "Electronics" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, data: { name: "Electronics", slug: "electronics" } });
  });

  it("rejects a request with no X-Admin-Key header", async () => {
    const res = await request(app).post("/api/admin/categories").send({ name: "Electronics" });

    expect(res.status).toBe(401);
    expect(categoriesRepository.create).not.toHaveBeenCalled();
  });

  it("rejects a request with no name", async () => {
    const res = await request(app)
      .post("/api/admin/categories")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(categoriesRepository.create).not.toHaveBeenCalled();
  });

  it("rejects creating a subcategory under an existing subcategory", async () => {
    const grandparentId = new Types.ObjectId();
    const parentId = new Types.ObjectId();
    vi.mocked(categoriesRepository.slugExists).mockResolvedValue(false);
    vi.mocked(categoriesRepository.findById).mockResolvedValue({
      _id: parentId,
      name: "Phones",
      slug: "phones",
      parentCategory: grandparentId,
      sortOrder: 0,
      status: true,
      createdBy: null,
      updatedBy: null,
    });

    const res = await request(app)
      .post("/api/admin/categories")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ name: "Smartphones", parentCategory: parentId.toString() });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PARENT_CATEGORY_TOO_DEEP");
    expect(categoriesRepository.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/categories/:id", () => {
  it("rejects a malformed id", async () => {
    const res = await request(app)
      .patch("/api/admin/categories/not-an-id")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ name: "X" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ID");
  });

  it("returns 404 when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.updateById).mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/admin/categories/${new Types.ObjectId().toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ name: "X" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
  });

  it("updates the provided fields and never patches the slug", async () => {
    const id = new Types.ObjectId();
    vi.mocked(categoriesRepository.updateById).mockResolvedValue({
      _id: id,
      name: "Updated",
      slug: "electronics",
      parentCategory: null,
      sortOrder: 0,
      status: true,
      createdBy: null,
      updatedBy: null,
    });

    const res = await request(app)
      .patch(`/api/admin/categories/${id.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ name: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated");
    const patch = vi.mocked(categoriesRepository.updateById).mock.calls[0]?.[1];
    expect(patch).not.toHaveProperty("slug");
  });

  it("rejects clearing then re-parenting to itself", async () => {
    const id = new Types.ObjectId();

    const res = await request(app)
      .patch(`/api/admin/categories/${id.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ parentCategory: id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PARENT_CATEGORY");
    expect(categoriesRepository.updateById).not.toHaveBeenCalled();
  });

  it("rejects assigning a parent to a category that already has subcategories", async () => {
    const id = new Types.ObjectId();
    const parentId = new Types.ObjectId();
    vi.mocked(categoriesRepository.findById).mockResolvedValue({
      _id: parentId,
      name: "Home",
      slug: "home",
      parentCategory: null,
      sortOrder: 0,
      status: true,
      createdBy: null,
      updatedBy: null,
    });
    vi.mocked(categoriesRepository.countByParent).mockResolvedValue(2);

    const res = await request(app)
      .patch(`/api/admin/categories/${id.toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ parentCategory: parentId.toString() });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CATEGORY_HAS_SUBCATEGORIES");
    expect(categoriesRepository.updateById).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/categories", () => {
  it("returns each category with an accurate product count across statuses", async () => {
    const idA = new Types.ObjectId();
    const idB = new Types.ObjectId();
    vi.mocked(categoriesRepository.list).mockResolvedValue([
      { _id: idA, name: "Electronics", slug: "electronics", parentCategory: null, sortOrder: 0, status: true, createdBy: null, updatedBy: null },
      { _id: idB, name: "Furniture", slug: "furniture", parentCategory: null, sortOrder: 1, status: true, createdBy: null, updatedBy: null },
    ]);
    vi.mocked(productsRepository.countByCategoryIds).mockResolvedValue(new Map([[idA.toString(), 4]]));

    const res = await request(app).get("/api/admin/categories").set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ name: "Electronics", productCount: 4 }),
      expect.objectContaining({ name: "Furniture", productCount: 0 }),
    ]);
  });
});

describe("GET /api/admin/categories/:id", () => {
  it("returns 404 for a category that doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/admin/categories/${new Types.ObjectId().toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
  });
});

describe("DELETE /api/admin/categories/:id", () => {
  it("names both blocking reasons when the category has products and subcategories", async () => {
    vi.mocked(productsRepository.countByCategory).mockResolvedValue(3);
    vi.mocked(categoriesRepository.countByParent).mockResolvedValue(1);

    const res = await request(app)
      .delete(`/api/admin/categories/${new Types.ObjectId().toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CATEGORY_IN_USE");
    expect(res.body.message).toContain("3 product");
    expect(res.body.message).toContain("1 subcategor");
    expect(categoriesRepository.deleteById).not.toHaveBeenCalled();
  });

  it("deletes when there are zero products and zero subcategories", async () => {
    vi.mocked(productsRepository.countByCategory).mockResolvedValue(0);
    vi.mocked(categoriesRepository.countByParent).mockResolvedValue(0);

    const res = await request(app)
      .delete(`/api/admin/categories/${new Types.ObjectId().toString()}`)
      .set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(res.status).toBe(200);
    expect(categoriesRepository.deleteById).toHaveBeenCalled();
  });
});

describe("GET /api/categories", () => {
  it("requires no admin key, excludes inactive/admin fields, and applies the SEO fallback", async () => {
    // Ordering itself (sortOrder asc, name asc) is enforced by
    // categories.repository.ts's listActive() query — unverifiable here
    // since the repository is mocked; this only confirms the service
    // preserves whatever order the repository returns.
    const id = new Types.ObjectId();
    vi.mocked(categoriesRepository.listActive).mockResolvedValue([
      {
        _id: id,
        name: "Electronics",
        slug: "electronics",
        parentCategory: null,
        sortOrder: 0,
        status: true,
        createdBy: null,
        updatedBy: null,
      },
    ]);

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        _id: id.toString(),
        name: "Electronics",
        slug: "electronics",
        parentCategory: null,
        sortOrder: 0,
        metaTitle: "Electronics",
        metaDescription: "Electronics",
      },
    ]);
    expect(res.body.data[0]).not.toHaveProperty("status");
    expect(res.body.data[0]).not.toHaveProperty("createdBy");
  });
});
