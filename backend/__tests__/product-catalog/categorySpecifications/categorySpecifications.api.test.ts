import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@/modules/product-catalog/features/categorySpecifications/categorySpecifications.repository", () => ({
  findByCategory: vi.fn(),
  replaceGroups: vi.fn(),
  deleteByCategory: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/categories/categories.repository", () => ({
  findById: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/products/products.repository", () => ({
  countBySpecificationField: vi.fn(),
}));

import app from "@/app";
import { env } from "@/config/env";
import * as categorySpecificationsRepository from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.repository";
import * as categoriesRepository from "@/modules/product-catalog/features/categories/categories.repository";
import * as productsRepository from "@/modules/product-catalog/features/products/products.repository";
import type { SpecificationGroup } from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.model";

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
  it("rejects a request with no X-Admin-Key header", async () => {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    const res = await request(app).get(url).set("X-Admin-Key", env.ADMIN_API_KEY);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
  });

  it("returns an empty default when no schema has been defined yet", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(null);

    const res = await request(app).get(url).set("X-Admin-Key", env.ADMIN_API_KEY);

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

    const res = await request(app).get(url).set("X-Admin-Key", env.ADMIN_API_KEY);

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

    const res = await request(app).put(url).set("X-Admin-Key", env.ADMIN_API_KEY).send(body);

    expect(res.status).toBe(200);
    expect(categorySpecificationsRepository.replaceGroups).toHaveBeenCalledWith(
      categoryId,
      body.specificationGroups,
    );
  });

  it("rejects filterable: true on a text field", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({
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

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ specificationGroups: [{ groupName: "Group", specifications: [field] }] });

    expect(res.status).toBe(200);
  });

  it("rejects an enum field with no options", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({
        specificationGroups: [
          { groupName: "Group", specifications: [{ name: "Color", type: "enum", required: false, filterable: false }] },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects duplicate group names in the payload", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({
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

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ specificationGroups: [] });

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

    const res = await request(app)
      .patch(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ op: "deleteField", groupName: "Display", name: "Screen Size" });

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

    const res = await request(app)
      .patch(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ op: "deleteField", groupName: "Display", name: "Screen Size" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SPECIFICATION_FIELD_IN_USE");
    expect(res.body.message).toContain("5");
    expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
  });

  it("rejects a malformed operation body", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await request(app)
      .patch(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ op: "notARealOp" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
