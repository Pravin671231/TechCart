import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Issue #143/M3.5 — every route in this module is admin-only and now gated
// by rbac.ts, which needs a real session to resolve, not the old
// X-Admin-Key header — see brands.api.test.ts's own header comment for
// the full rationale.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/product-catalog/features/categorySpecifications/categorySpecifications.repository", () => ({
  findByCategory: vi.fn(),
  replaceGroups: vi.fn(),
  deleteByCategory: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/categories/categories.repository", () => ({
  CATEGORY_SORT_FIELDS: ["name", "sortOrder", "createdAt"],
  findById: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/products/products.repository", () => ({
  PRODUCT_SORT_FIELDS: ["createdAt", "name"],
  countBySpecificationField: vi.fn(),
}));

import * as categorySpecificationsRepository from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.repository";
import * as categoriesRepository from "@/modules/product-catalog/features/categories/categories.repository";
import * as productsRepository from "@/modules/product-catalog/features/products/products.repository";
import type { SpecificationGroup } from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.model";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const CATALOG_MANAGER_EMAIL = "categoryspecs-catalog-manager@example.com";
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
    name: "Category Specs Catalog Manager Fixture",
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
const url = `/api/admin/categories/${categoryId.toString()}/specifications`;

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/categories/:id/specifications", () => {
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

  it("returns an empty default when no schema has been defined yet", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(null);

    const res = await admin("get", url);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ category: categoryId.toString(), specificationGroups: [] });
  });

  it("preserves field declaration order on read", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    const orderedGroups: SpecificationGroup[] = [
      {
        groupName: "Display",
        specifications: [
          { name: "Resolution", type: "text", required: false, filterable: false },
          { name: "Screen Size", type: "number", required: true, filterable: true },
        ],
      },
    ];
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      specificationGroups: orderedGroups,
    });

    const res = await admin("get", url);

    expect(res.status).toBe(200);
    expect(res.body.data.specificationGroups[0].specifications.map((f: { name: string }) => f.name)).toEqual([
      "Resolution",
      "Screen Size",
    ]);
  });
});

describe("PUT /api/admin/categories/:id/specifications", () => {
  it("defines the schema and preserves declaration order", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    const body: { specificationGroups: SpecificationGroup[] } = {
      specificationGroups: [
        {
          groupName: "Display",
          specifications: [
            { name: "Screen Size", type: "number", unit: "inches", required: true, filterable: true },
            { name: "Resolution", type: "text", required: false, filterable: false },
          ],
        },
      ],
    };
    vi.mocked(categorySpecificationsRepository.replaceGroups).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      specificationGroups: body.specificationGroups,
    });

    const res = await admin("put", url).send(body);

    expect(res.status).toBe(200);
    expect(categorySpecificationsRepository.replaceGroups).toHaveBeenCalledWith(
      categoryId,
      body.specificationGroups,
    );
  });

  it("rejects filterable: true on a text field", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await admin("put", url).send({
      specificationGroups: [
        {
          groupName: "Display",
          specifications: [{ name: "Resolution", type: "text", required: false, filterable: true }],
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
  });

  it.each(["enum", "boolean", "number"] as const)("accepts filterable: true on a %s field", async (type) => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    const field =
      type === "enum"
        ? { name: "Color", type, options: ["Black", "White"], required: false, filterable: true }
        : { name: "Field", type, required: false, filterable: true };
    vi.mocked(categorySpecificationsRepository.replaceGroups).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      specificationGroups: [{ groupName: "Group", specifications: [field] }],
    });

    const res = await admin("put", url).send({
      specificationGroups: [{ groupName: "Group", specifications: [field] }],
    });

    expect(res.status).toBe(200);
  });

  it("rejects an enum field with no options", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await admin("put", url).send({
      specificationGroups: [
        { groupName: "Group", specifications: [{ name: "Color", type: "enum", required: false, filterable: false }] },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects duplicate group names in the payload", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await admin("put", url).send({
      specificationGroups: [
        { groupName: "Display", specifications: [] },
        { groupName: "Display", specifications: [] },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_SPECIFICATION_GROUP");
    expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
  });

  it("returns 404 when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    const res = await admin("put", url).send({ specificationGroups: [] });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
  });
});

describe("PATCH /api/admin/categories/:id/specifications", () => {
  const storedGroups: SpecificationGroup[] = [
    {
      groupName: "Display",
      specifications: [{ name: "Screen Size", type: "number", required: true, filterable: true }],
    },
  ];

  it("deletes a field that isn't in use", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      specificationGroups: storedGroups,
    });
    vi.mocked(productsRepository.countBySpecificationField).mockResolvedValue(0);
    vi.mocked(categorySpecificationsRepository.replaceGroups).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      specificationGroups: [{ groupName: "Display", specifications: [] }],
    });

    const res = await admin("patch", url).send({
      op: "deleteField",
      groupName: "Display",
      name: "Screen Size",
    });

    expect(res.status).toBe(200);
    expect(categorySpecificationsRepository.replaceGroups).toHaveBeenCalledWith(categoryId, [
      { groupName: "Display", specifications: [] },
    ]);
  });

  it("rejects deleting a field currently referenced by a product, naming the blocking count", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue({
      _id: new Types.ObjectId(),
      category: categoryId,
      specificationGroups: storedGroups,
    });
    vi.mocked(productsRepository.countBySpecificationField).mockResolvedValue(5);

    const res = await admin("patch", url).send({
      op: "deleteField",
      groupName: "Display",
      name: "Screen Size",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SPECIFICATION_FIELD_IN_USE");
    expect(res.body.message).toContain("5");
    expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
  });

  it("rejects a malformed operation body", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await admin("patch", url).send({ op: "notARealOp" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
