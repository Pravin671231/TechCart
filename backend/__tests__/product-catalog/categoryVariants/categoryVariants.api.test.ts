import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Issue #143/M3.5 — every route in this module is admin-only and now gated
// by rbac.ts, which needs a real Better Auth session to resolve, not the
// old X-Admin-Key header — see brands.api.test.ts's own header comment for
// the full rationale.
vi.mock("@/externalService/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/product-catalog/features/categoryVariants/categoryVariants.repository", () => ({
  findByCategory: vi.fn(),
  replaceAxes: vi.fn(),
  deleteByCategory: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/categories/categories.repository", () => ({
  CATEGORY_SORT_FIELDS: ["name", "sortOrder", "createdAt"],
  findById: vi.fn(),
}));

import * as categoryVariantsRepository from "@/modules/product-catalog/features/categoryVariants/categoryVariants.repository";
import * as categoriesRepository from "@/modules/product-catalog/features/categories/categories.repository";
import type { VariantAxis } from "@/modules/product-catalog/features/categoryVariants/categoryVariants.model";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const CATALOG_MANAGER_EMAIL = "categoryvariants-catalog-manager@example.com";
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
    name: "Category Variants Catalog Manager Fixture",
    role: "catalog-manager",
  });
  token = await signInFully(app, CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

function admin(method: "get" | "put" | "patch", url: string) {
  return authRequest(app, method, url, token);
}

const categoryId = new Types.ObjectId();
const url = `/api/admin/categories/${categoryId.toString()}/variant-types`;

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

const colorAxis: VariantAxis = {
  name: "Color",
  code: "color",
  type: "color",
  required: true,
  options: [
    { label: "Red", value: "red" },
    { label: "Blue", value: "blue" },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/categories/:id/variant-types", () => {
  it("rejects a request with no session at all", async () => {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    const res = await admin("get", url);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
  });

  it("returns an empty default when no axes have been defined yet", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(null);

    const res = await admin("get", url);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ category: categoryId.toString(), variants: [] });
  });

  it("preserves axis declaration order and faithfully returns type/options", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    const sizeAxis: VariantAxis = {
      name: "Size",
      code: "size",
      type: "select",
      required: false,
      options: [
        { label: "Small", value: "S" },
        { label: "Large", value: "L" },
      ],
    };
    vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      variants: [sizeAxis, colorAxis],
    });

    const res = await admin("get", url);

    expect(res.status).toBe(200);
    expect(res.body.data.variants.map((axis: { code: string }) => axis.code)).toEqual([
      "size",
      "color",
    ]);
    expect(res.body.data.variants[0]).toMatchObject({ type: "select", options: sizeAxis.options });
  });
});

describe("PUT /api/admin/categories/:id/variant-types", () => {
  it("defines the axes and preserves declaration order", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    const body = { variants: [colorAxis] };
    vi.mocked(categoryVariantsRepository.replaceAxes).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      variants: body.variants,
    });

    const res = await admin("put", url).send(body);

    expect(res.status).toBe(200);
    expect(categoryVariantsRepository.replaceAxes).toHaveBeenCalledWith(categoryId, body.variants);
  });

  it("rejects a select axis with no options", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await admin("put", url).send({
      variants: [{ name: "Size", code: "size", type: "select", required: false }],
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
  });

  it("rejects a text axis carrying options", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await admin("put", url).send({
      variants: [
        {
          name: "Material",
          code: "material",
          type: "text",
          required: false,
          options: [{ label: "Steel", value: "steel" }],
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("defaults type to select when omitted", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    const options = [{ label: "Small", value: "S" }];
    vi.mocked(categoryVariantsRepository.replaceAxes).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      variants: [{ name: "Size", code: "size", type: "select", required: false, options }],
    });

    const res = await admin("put", url).send({
      variants: [{ name: "Size", code: "size", options, required: false }],
    });

    expect(res.status).toBe(200);
    expect(categoryVariantsRepository.replaceAxes).toHaveBeenCalledWith(
      categoryId,
      expect.arrayContaining([expect.objectContaining({ type: "select" })]),
    );
  });

  it("rejects duplicate axis codes in the payload", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await admin("put", url).send({
      variants: [colorAxis, { ...colorAxis, name: "Colour" }],
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_VARIANT_AXIS");
    expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
  });

  it("returns 404 when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    const res = await admin("put", url).send({ variants: [] });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
  });
});

describe("PATCH /api/admin/categories/:id/variant-types", () => {
  const storedAxes: VariantAxis[] = [colorAxis];

  it("deletes an axis unconditionally, with no in-use check", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      variants: storedAxes,
    });
    vi.mocked(categoryVariantsRepository.replaceAxes).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      variants: [],
    });

    const res = await admin("patch", url).send({ op: "deleteAxis", code: "color" });

    expect(res.status).toBe(200);
    expect(categoryVariantsRepository.replaceAxes).toHaveBeenCalledWith(categoryId, []);
  });

  it("returns VARIANT_AXIS_NOT_FOUND when the axis doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      variants: storedAxes,
    });

    const res = await admin("patch", url).send({ op: "deleteAxis", code: "nope" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VARIANT_AXIS_NOT_FOUND");
    expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
  });

  it("rejects a malformed operation body", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await admin("patch", url).send({ op: "notARealOp" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
