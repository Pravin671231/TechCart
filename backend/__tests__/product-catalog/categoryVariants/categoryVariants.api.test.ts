import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@/modules/product-catalog/features/categoryVariants/categoryVariants.repository", () => ({
  findByCategory: vi.fn(),
  replaceAxes: vi.fn(),
  deleteByCategory: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/categories/categories.repository", () => ({
  CATEGORY_SORT_FIELDS: ["name", "sortOrder", "createdAt"],
  findById: vi.fn(),
}));

import app from "@/app";
import { env } from "@/config/env";
import * as categoryVariantsRepository from "@/modules/product-catalog/features/categoryVariants/categoryVariants.repository";
import * as categoriesRepository from "@/modules/product-catalog/features/categories/categories.repository";
import type { VariantAxis } from "@/modules/product-catalog/features/categoryVariants/categoryVariants.model";

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

  it("returns an empty default when no axes have been defined yet", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(null);

    const res = await request(app).get(url).set("X-Admin-Key", env.ADMIN_API_KEY);

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

    const res = await request(app).get(url).set("X-Admin-Key", env.ADMIN_API_KEY);

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

    const res = await request(app).put(url).set("X-Admin-Key", env.ADMIN_API_KEY).send(body);

    expect(res.status).toBe(200);
    expect(categoryVariantsRepository.replaceAxes).toHaveBeenCalledWith(categoryId, body.variants);
  });

  it("rejects a select axis with no options", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ variants: [{ name: "Size", code: "size", type: "select", required: false }] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
  });

  it("rejects a text axis carrying options", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({
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

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ variants: [{ name: "Size", code: "size", options, required: false }] });

    expect(res.status).toBe(200);
    expect(categoryVariantsRepository.replaceAxes).toHaveBeenCalledWith(
      categoryId,
      expect.arrayContaining([expect.objectContaining({ type: "select" })]),
    );
  });

  it("rejects duplicate axis codes in the payload", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ variants: [colorAxis, { ...colorAxis, name: "Colour" }] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_VARIANT_AXIS");
    expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
  });

  it("returns 404 when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    const res = await request(app)
      .put(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ variants: [] });

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

    const res = await request(app)
      .patch(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ op: "deleteAxis", code: "color" });

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

    const res = await request(app)
      .patch(url)
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ op: "deleteAxis", code: "nope" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VARIANT_AXIS_NOT_FOUND");
    expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
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
