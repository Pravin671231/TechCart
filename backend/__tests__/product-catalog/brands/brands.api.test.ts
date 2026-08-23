import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Issue #143/M3.5 — every /api/admin/brands route is now gated by rbac.ts,
// which needs a real Better Auth session (auth.api.getSession) to resolve,
// not the old X-Admin-Key header. Adopts the mongodb-memory-server harness
// __tests__/auth/*/__tests__/adminUsers/* already use for exactly that
// reason — brands/products.repository stay mocked below, same as before;
// only session resolution touches a real DB.
vi.mock("@/externalService/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/product-catalog/features/brands/brands.repository", () => ({
  BRAND_SORT_FIELDS: ["name", "createdAt"],
  create: vi.fn(),
  findById: vi.fn(),
  slugExists: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  list: vi.fn(),
  listActive: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/products/products.repository", () => ({
  PRODUCT_SORT_FIELDS: ["createdAt", "name"],
  countByBrand: vi.fn(),
  countByBrandIds: vi.fn(),
}));

vi.mock("@/modules/uploads/uploads.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/uploads/uploads.service")>();
  return {
    ...actual,
    consumeImageKeys: vi.fn(),
    buildPublicUrl: vi.fn((objectKey: string) => `https://cdn.test.example/${objectKey}`),
  };
});

import * as brandsRepository from "@/modules/product-catalog/features/brands/brands.repository";
import * as productsRepository from "@/modules/product-catalog/features/products/products.repository";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const CATALOG_MANAGER_EMAIL = "brands-catalog-manager@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;

  const { provisionAdminUser } = await import("../../../src/scripts/seed/createAdminUser.js");
  await provisionAdminUser({
    email: CATALOG_MANAGER_EMAIL,
    password: CATALOG_MANAGER_PASSWORD,
    name: "Brands Catalog Manager Fixture",
    role: "catalog-manager",
  });
  token = await signInFully(app, CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

function admin(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, token);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/brands", () => {
  it("creates a brand and auto-generates a slug", async () => {
    vi.mocked(brandsRepository.slugExists).mockResolvedValue(false);
    const id = new Types.ObjectId();
    vi.mocked(brandsRepository.create).mockImplementation(async (doc) => ({
      _id: id,
      status: true,
      ...doc,
    }));

    const res = await admin("post", "/api/admin/brands").send({ name: "Nova" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, data: { name: "Nova", slug: "nova" } });
  });

  it("gives two brands created with the same name distinct slugs", async () => {
    const idA = new Types.ObjectId();
    const idB = new Types.ObjectId();
    vi.mocked(brandsRepository.slugExists)
      .mockResolvedValueOnce(false) // first create: "nova" is free
      .mockResolvedValueOnce(true) // second create: "nova" now taken
      .mockResolvedValueOnce(false); // "nova-2" is free
    vi.mocked(brandsRepository.create)
      .mockImplementationOnce(async (doc) => ({
        _id: idA,
        status: true,
        ...doc,
      }))
      .mockImplementationOnce(async (doc) => ({
        _id: idB,
        status: true,
        ...doc,
      }));

    const first = await admin("post", "/api/admin/brands").send({ name: "Nova" });
    const second = await admin("post", "/api/admin/brands").send({ name: "Nova" });

    expect(first.body.data.slug).toBe("nova");
    expect(second.body.data.slug).toBe("nova-2");
  });

  it("rejects a request with no session at all", async () => {
    const res = await request(app).post("/api/admin/brands").send({ name: "Nova" });

    expect(res.status).toBe(401);
    expect(brandsRepository.create).not.toHaveBeenCalled();
  });

  it("rejects a request with no name", async () => {
    const res = await admin("post", "/api/admin/brands").send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(brandsRepository.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/brands/:id", () => {
  it("rejects a malformed id", async () => {
    const res = await admin("patch", "/api/admin/brands/not-an-id").send({ name: "X" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ID");
  });

  it("returns 404 when the brand doesn't exist", async () => {
    vi.mocked(brandsRepository.updateById).mockResolvedValue(null);

    const res = await admin(
      "patch",
      `/api/admin/brands/${new Types.ObjectId().toString()}`,
    ).send({ name: "X" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BRAND_NOT_FOUND");
  });

  it("updates the provided fields and never patches the slug", async () => {
    const id = new Types.ObjectId();
    vi.mocked(brandsRepository.updateById).mockResolvedValue({
      _id: id,
      name: "Nova Updated",
      slug: "nova",
      status: true,
      createdBy: null,
      updatedBy: null,
    });

    const res = await admin("patch", `/api/admin/brands/${id.toString()}`).send({
      name: "Nova Updated",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Nova Updated");
    const patch = vi.mocked(brandsRepository.updateById).mock.calls[0]?.[1];
    expect(patch).not.toHaveProperty("slug");
  });
});

describe("GET /api/admin/brands", () => {
  it("returns each brand with an accurate product count across statuses", async () => {
    const idA = new Types.ObjectId();
    const idB = new Types.ObjectId();
    vi.mocked(brandsRepository.list).mockResolvedValue({
      items: [
        { _id: idA, name: "Nova", slug: "nova", status: true, createdBy: null, updatedBy: null },
        { _id: idB, name: "Zeta", slug: "zeta", status: true, createdBy: null, updatedBy: null },
      ],
      total: 2,
    });
    // Stands in for "brand A has 2 products (one draft, one archived), brand
    // B has none" — the actual cross-status counting is products.repository's
    // job (no status filter in its $match), verified by reading that source.
    vi.mocked(productsRepository.countByBrandIds).mockResolvedValue(new Map([[idA.toString(), 2]]));

    const res = await admin("get", "/api/admin/brands");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ name: "Nova", productCount: 2 }),
      expect.objectContaining({ name: "Zeta", productCount: 0 }),
    ]);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
    });
  });

  it("passes a search query param through to the repository as a name regex filter", async () => {
    vi.mocked(brandsRepository.list).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(productsRepository.countByBrandIds).mockResolvedValue(new Map());

    await admin("get", "/api/admin/brands?search=nov");

    expect(brandsRepository.list).toHaveBeenCalledWith(
      { $or: [{ name: { $regex: "nov", $options: "i" } }] },
      undefined,
      { page: 1, limit: 20 },
    );
  });

  it("accepts page/limit/sortBy/orderBy query params", async () => {
    vi.mocked(brandsRepository.list).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(productsRepository.countByBrandIds).mockResolvedValue(new Map());

    await admin("get", "/api/admin/brands?page=2&limit=5&sortBy=name&orderBy=asc");

    expect(brandsRepository.list).toHaveBeenCalledWith(
      {},
      { field: "name", order: 1 },
      { page: 2, limit: 5 },
    );
  });

  it("rejects an unrecognized sortBy value", async () => {
    const res = await admin("get", "/api/admin/brands?sortBy=badfield");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an oversized limit", async () => {
    const res = await admin("get", "/api/admin/brands?limit=1000");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/admin/brands/:id", () => {
  it("returns 404 for a brand that doesn't exist", async () => {
    vi.mocked(brandsRepository.findById).mockResolvedValue(null);

    const res = await admin("get", `/api/admin/brands/${new Types.ObjectId().toString()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BRAND_NOT_FOUND");
  });
});

describe("PATCH /api/admin/brands/:id/status", () => {
  it("rejects a request with no session at all", async () => {
    const res = await request(app)
      .patch(`/api/admin/brands/${new Types.ObjectId().toString()}/status`)
      .send({ status: false });
    expect(res.status).toBe(401);
  });

  it("deactivates a brand without checking the delete guard", async () => {
    const id = new Types.ObjectId();
    vi.mocked(brandsRepository.updateById).mockResolvedValue({
      _id: id,
      name: "Nova",
      slug: "nova",
      status: false,
      createdBy: null,
      updatedBy: null,
    });

    const res = await admin("patch", `/api/admin/brands/${id.toString()}/status`).send({
      status: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(false);
    expect(brandsRepository.updateById).toHaveBeenCalledWith(id, {
      status: false,
      updatedBy: expect.any(Types.ObjectId),
    });
    expect(productsRepository.countByBrand).not.toHaveBeenCalled();
  });

  it("returns BRAND_NOT_FOUND for a nonexistent id", async () => {
    vi.mocked(brandsRepository.updateById).mockResolvedValue(null);

    const res = await admin(
      "patch",
      `/api/admin/brands/${new Types.ObjectId().toString()}/status`,
    ).send({ status: false });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BRAND_NOT_FOUND");
  });

  it("rejects a non-boolean status", async () => {
    const res = await admin(
      "patch",
      `/api/admin/brands/${new Types.ObjectId().toString()}/status`,
    ).send({ status: "inactive" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /api/admin/brands/:id", () => {
  it("rejects deletion when the brand is referenced by even an archived-only product", async () => {
    vi.mocked(productsRepository.countByBrand).mockResolvedValue(1);

    const res = await admin("delete", `/api/admin/brands/${new Types.ObjectId().toString()}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("BRAND_IN_USE");
    expect(brandsRepository.deleteById).not.toHaveBeenCalled();
  });

  it("deletes when no products reference the brand", async () => {
    vi.mocked(productsRepository.countByBrand).mockResolvedValue(0);

    const res = await admin("delete", `/api/admin/brands/${new Types.ObjectId().toString()}`);

    expect(res.status).toBe(200);
    expect(brandsRepository.deleteById).toHaveBeenCalled();
  });
});

describe("GET /api/brands", () => {
  it("requires no session and excludes inactive brands and admin-only fields", async () => {
    const id = new Types.ObjectId();
    vi.mocked(brandsRepository.listActive).mockResolvedValue([
      { _id: id, name: "Nova", slug: "nova", status: true, createdBy: null, updatedBy: null },
    ]);

    const res = await request(app).get("/api/brands");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ _id: id.toString(), name: "Nova", slug: "nova" }]);
    expect(res.body.data[0]).not.toHaveProperty("status");
    expect(res.body.data[0]).not.toHaveProperty("createdBy");
    expect(res.body.data[0]).not.toHaveProperty("updatedBy");
  });
});
