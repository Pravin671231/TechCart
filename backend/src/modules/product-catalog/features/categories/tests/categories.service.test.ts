import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryRecord } from "../categories.repository";

vi.mock("../categories.repository", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  slugExists: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  list: vi.fn(),
  listActive: vi.fn(),
  findActiveBySlug: vi.fn(),
  listActiveChildIds: vi.fn(),
  countByParent: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/products/products.repository", () => ({
  countByCategory: vi.fn(),
  countByCategoryIds: vi.fn(),
}));

vi.mock("@/modules/uploads/uploads.service", () => ({
  consumeImageKeys: vi.fn(),
  buildPublicUrl: vi.fn((objectKey: string) => `https://cdn.test/${objectKey}`),
}));

vi.mock("@/modules/product-catalog/features/categorySpecifications/categorySpecifications.service", () => ({
  deleteForCategory: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/categoryVariants/categoryVariants.service", () => ({
  deleteForCategory: vi.fn(),
}));

import * as categoriesRepository from "../categories.repository";
import * as productsRepository from "@/modules/product-catalog/features/products/products.repository";
import * as uploadsService from "@/modules/uploads/uploads.service";
import * as categorySpecificationsService from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.service";
import * as categoryVariantsService from "@/modules/product-catalog/features/categoryVariants/categoryVariants.service";
import {
  createCategory,
  updateCategory,
  getCategoryById,
  listCategoriesForAdmin,
  listCategoriesForPublic,
  deleteCategory,
  updateCategoryStatus,
  getActiveCategoryBySlug,
  listActiveSubcategoryIds,
} from "../categories.service";

const idA = new Types.ObjectId();
const idB = new Types.ObjectId();
const idParent = new Types.ObjectId();
const idGrandparent = new Types.ObjectId();

const categoryA: CategoryRecord = {
  _id: idA,
  name: "Electronics",
  slug: "electronics",
  parentCategory: null,
  sortOrder: 0,
  status: true,
  createdBy: null,
  updatedBy: null,
};

const categoryB: CategoryRecord = {
  _id: idB,
  name: "Furniture",
  slug: "furniture",
  parentCategory: null,
  sortOrder: 1,
  status: true,
  createdBy: null,
  updatedBy: null,
};

const topLevelParent: CategoryRecord = {
  _id: idParent,
  name: "Home",
  slug: "home",
  parentCategory: null,
  sortOrder: 0,
  status: true,
  createdBy: null,
  updatedBy: null,
};

const deepParent: CategoryRecord = {
  _id: idParent,
  name: "Sub Home",
  slug: "sub-home",
  parentCategory: idGrandparent,
  sortOrder: 0,
  status: true,
  createdBy: null,
  updatedBy: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("createCategory", () => {
  it("generates a slug from the name and persists it", async () => {
    vi.mocked(categoriesRepository.slugExists).mockResolvedValue(false);
    vi.mocked(categoriesRepository.create).mockResolvedValue(categoryA);

    await createCategory({ name: "Electronics" });

    expect(categoriesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Electronics", slug: "electronics" }),
    );
  });

  it("appends a numeric suffix when the slug collides", async () => {
    vi.mocked(categoriesRepository.slugExists)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(categoriesRepository.create).mockResolvedValue(categoryA);

    await createCategory({ name: "Electronics" });

    expect(categoriesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "electronics-2" }),
    );
  });

  it("consumes the image key and stores a built url when an image is provided", async () => {
    vi.mocked(categoriesRepository.slugExists).mockResolvedValue(false);
    vi.mocked(categoriesRepository.create).mockResolvedValue(categoryA);

    await createCategory({
      name: "Electronics",
      image: { objectKey: "category-image/abc.png", alt: "Electronics" },
    });

    expect(uploadsService.consumeImageKeys).toHaveBeenCalledWith(["category-image/abc.png"]);
    expect(categoriesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        image: { url: "https://cdn.test/category-image/abc.png", alt: "Electronics" },
      }),
    );
  });

  it("does not touch uploads or include an image key when none is provided", async () => {
    vi.mocked(categoriesRepository.slugExists).mockResolvedValue(false);
    vi.mocked(categoriesRepository.create).mockResolvedValue(categoryA);

    await createCategory({ name: "Electronics" });

    expect(uploadsService.consumeImageKeys).not.toHaveBeenCalled();
    const doc = vi.mocked(categoriesRepository.create).mock.calls[0]?.[0];
    expect(doc).not.toHaveProperty("image");
  });

  it("does not validate a parent when none is provided", async () => {
    vi.mocked(categoriesRepository.slugExists).mockResolvedValue(false);
    vi.mocked(categoriesRepository.create).mockResolvedValue(categoryA);

    await createCategory({ name: "Electronics" });

    expect(categoriesRepository.findById).not.toHaveBeenCalled();
  });

  it("rejects a parentCategory that doesn't exist", async () => {
    vi.mocked(categoriesRepository.slugExists).mockResolvedValue(false);
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    await expect(
      createCategory({ name: "Phones", parentCategory: idParent }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "PARENT_CATEGORY_NOT_FOUND",
    });
    expect(categoriesRepository.create).not.toHaveBeenCalled();
  });

  it("rejects a parentCategory that itself already has a parent", async () => {
    vi.mocked(categoriesRepository.slugExists).mockResolvedValue(false);
    vi.mocked(categoriesRepository.findById).mockResolvedValue(deepParent);

    await expect(
      createCategory({ name: "Phones", parentCategory: idParent }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "PARENT_CATEGORY_TOO_DEEP",
    });
    expect(categoriesRepository.create).not.toHaveBeenCalled();
  });

  it("accepts a valid top-level parentCategory", async () => {
    vi.mocked(categoriesRepository.slugExists).mockResolvedValue(false);
    vi.mocked(categoriesRepository.findById).mockResolvedValue(topLevelParent);
    vi.mocked(categoriesRepository.create).mockResolvedValue(categoryA);

    await createCategory({ name: "Phones", parentCategory: idParent });

    expect(categoriesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ parentCategory: idParent }),
    );
  });
});

describe("updateCategory", () => {
  it("updates only the provided fields and never touches the slug", async () => {
    vi.mocked(categoriesRepository.updateById).mockResolvedValue({ ...categoryA, name: "Updated" });

    await updateCategory(idA, { name: "Updated" });

    const patch = vi.mocked(categoriesRepository.updateById).mock.calls[0]?.[1];
    expect(patch).toEqual({ name: "Updated" });
    expect(patch).not.toHaveProperty("slug");
  });

  it("does not validate a parent when parentCategory is omitted", async () => {
    vi.mocked(categoriesRepository.updateById).mockResolvedValue(categoryA);

    await updateCategory(idA, { name: "Updated" });

    expect(categoriesRepository.findById).not.toHaveBeenCalled();
    expect(categoriesRepository.countByParent).not.toHaveBeenCalled();
  });

  it("clears the parent when parentCategory is explicitly null", async () => {
    vi.mocked(categoriesRepository.updateById).mockResolvedValue({
      ...categoryA,
      parentCategory: null,
    });

    await updateCategory(idA, { parentCategory: null });

    const patch = vi.mocked(categoriesRepository.updateById).mock.calls[0]?.[1];
    expect(patch).toHaveProperty("parentCategory", null);
    expect(categoriesRepository.findById).not.toHaveBeenCalled();
  });

  it("rejects setting a category as its own parent", async () => {
    await expect(updateCategory(idA, { parentCategory: idA })).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_PARENT_CATEGORY",
    });
    expect(categoriesRepository.updateById).not.toHaveBeenCalled();
  });

  it("rejects a parentCategory that doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    await expect(updateCategory(idA, { parentCategory: idParent })).rejects.toMatchObject({
      statusCode: 404,
      code: "PARENT_CATEGORY_NOT_FOUND",
    });
    expect(categoriesRepository.updateById).not.toHaveBeenCalled();
  });

  it("rejects a parentCategory that itself already has a parent", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(deepParent);

    await expect(updateCategory(idA, { parentCategory: idParent })).rejects.toMatchObject({
      statusCode: 400,
      code: "PARENT_CATEGORY_TOO_DEEP",
    });
    expect(categoriesRepository.updateById).not.toHaveBeenCalled();
  });

  it("rejects assigning a parent to a category that already has subcategories", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(topLevelParent);
    vi.mocked(categoriesRepository.countByParent).mockResolvedValue(2);

    await expect(updateCategory(idA, { parentCategory: idParent })).rejects.toMatchObject({
      statusCode: 400,
      code: "CATEGORY_HAS_SUBCATEGORIES",
    });
    expect(categoriesRepository.countByParent).toHaveBeenCalledWith(idA);
    expect(categoriesRepository.updateById).not.toHaveBeenCalled();
  });

  it("accepts a valid parent change when the category has no subcategories", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(topLevelParent);
    vi.mocked(categoriesRepository.countByParent).mockResolvedValue(0);
    vi.mocked(categoriesRepository.updateById).mockResolvedValue(categoryA);

    await updateCategory(idA, { parentCategory: idParent });

    const patch = vi.mocked(categoriesRepository.updateById).mock.calls[0]?.[1];
    expect(patch).toHaveProperty("parentCategory", idParent);
  });

  it("consumes a new image key and builds the url before persisting", async () => {
    vi.mocked(categoriesRepository.updateById).mockResolvedValue(categoryA);

    await updateCategory(idA, { image: { objectKey: "category-image/abc.png", alt: "Home" } });

    expect(uploadsService.consumeImageKeys).toHaveBeenCalledWith(["category-image/abc.png"]);
    const patch = vi.mocked(categoriesRepository.updateById).mock.calls[0]?.[1];
    expect(patch?.image).toEqual({ url: "https://cdn.test/category-image/abc.png", alt: "Home" });
  });

  it("throws CATEGORY_NOT_FOUND when the id doesn't match an existing category", async () => {
    vi.mocked(categoriesRepository.updateById).mockResolvedValue(null);

    await expect(updateCategory(idA, { name: "X" })).rejects.toMatchObject({
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
    });
  });
});

describe("getCategoryById", () => {
  it("returns the category when found", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryA);

    const result = await getCategoryById(idA);

    expect(result).toEqual(categoryA);
  });

  it("throws CATEGORY_NOT_FOUND when missing", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    await expect(getCategoryById(idA)).rejects.toMatchObject({
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
    });
  });
});

describe("listCategoriesForAdmin", () => {
  it("merges each category with its product count, defaulting to 0", async () => {
    vi.mocked(categoriesRepository.list).mockResolvedValue([categoryA, categoryB]);
    vi.mocked(productsRepository.countByCategoryIds).mockResolvedValue(
      new Map([[idA.toString(), 5]]),
    );

    const result = await listCategoriesForAdmin();

    expect(result).toEqual([
      { ...categoryA, productCount: 5 },
      { ...categoryB, productCount: 0 },
    ]);
    expect(productsRepository.countByCategoryIds).toHaveBeenCalledWith([idA, idB]);
  });

  it("passes the search term through to the repository", async () => {
    vi.mocked(categoriesRepository.list).mockResolvedValue([categoryA]);
    vi.mocked(productsRepository.countByCategoryIds).mockResolvedValue(new Map());

    await listCategoriesForAdmin("elec");

    expect(categoriesRepository.list).toHaveBeenCalledWith("elec");
  });
});

describe("listCategoriesForPublic", () => {
  it("strips admin-only fields and includes the parentCategory ref", async () => {
    vi.mocked(categoriesRepository.listActive).mockResolvedValue([
      { ...categoryA, metaTitle: "Custom Title", metaDescription: "Custom description." },
    ]);

    const result = await listCategoriesForPublic();

    expect(result[0]).toMatchObject({
      metaTitle: "Custom Title",
      metaDescription: "Custom description.",
      parentCategory: null,
    });
    expect(result[0]).not.toHaveProperty("status");
    expect(result[0]).not.toHaveProperty("createdBy");
    expect(result[0]).not.toHaveProperty("updatedBy");
  });

  it("includes the image when present", async () => {
    vi.mocked(categoriesRepository.listActive).mockResolvedValue([
      { ...categoryA, image: { url: "https://cdn.test/x.png", alt: "Electronics" } },
    ]);

    const result = await listCategoriesForPublic();

    expect(result[0]?.image).toEqual({ url: "https://cdn.test/x.png", alt: "Electronics" });
  });

  it("falls back metaTitle to the category name when unset", async () => {
    vi.mocked(categoriesRepository.listActive).mockResolvedValue([categoryA]);

    const result = await listCategoriesForPublic();

    expect(result[0]?.metaTitle).toBe("Electronics");
  });

  it("falls back metaDescription to a truncation of the description when unset", async () => {
    vi.mocked(categoriesRepository.listActive).mockResolvedValue([
      { ...categoryA, description: "a".repeat(200) },
    ]);

    const result = await listCategoriesForPublic();

    expect(result[0]?.metaDescription).toBe(`${"a".repeat(160)}...`);
  });

  it("falls back metaDescription to the category name when there is no description either", async () => {
    vi.mocked(categoriesRepository.listActive).mockResolvedValue([categoryA]);

    const result = await listCategoriesForPublic();

    expect(result[0]?.metaDescription).toBe("Electronics");
  });

  it("passes the search term through to the repository", async () => {
    vi.mocked(categoriesRepository.listActive).mockResolvedValue([categoryA]);

    await listCategoriesForPublic("elec");

    expect(categoriesRepository.listActive).toHaveBeenCalledWith("elec");
  });
});

describe("getActiveCategoryBySlug", () => {
  it("returns the category when it resolves to an active category", async () => {
    vi.mocked(categoriesRepository.findActiveBySlug).mockResolvedValue(categoryA);

    const result = await getActiveCategoryBySlug("electronics");

    expect(result).toEqual(categoryA);
    expect(categoriesRepository.findActiveBySlug).toHaveBeenCalledWith("electronics");
  });

  it("throws CATEGORY_NOT_FOUND when the slug doesn't resolve to an active category", async () => {
    vi.mocked(categoriesRepository.findActiveBySlug).mockResolvedValue(null);

    await expect(getActiveCategoryBySlug("missing")).rejects.toMatchObject({
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
    });
  });
});

describe("listActiveSubcategoryIds", () => {
  it("delegates to the repository's active-children lookup", async () => {
    const childId = new Types.ObjectId();
    vi.mocked(categoriesRepository.listActiveChildIds).mockResolvedValue([childId]);

    const result = await listActiveSubcategoryIds(idA);

    expect(result).toEqual([childId]);
    expect(categoriesRepository.listActiveChildIds).toHaveBeenCalledWith(idA);
  });
});

describe("deleteCategory", () => {
  it("names only products in the error when only products block deletion", async () => {
    vi.mocked(productsRepository.countByCategory).mockResolvedValue(3);
    vi.mocked(categoriesRepository.countByParent).mockResolvedValue(0);

    await expect(deleteCategory(idA)).rejects.toMatchObject({
      statusCode: 409,
      code: "CATEGORY_IN_USE",
      message: expect.stringContaining("3 product"),
    });
    expect(categoriesRepository.deleteById).not.toHaveBeenCalled();
  });

  it("names only subcategories in the error when only subcategories block deletion", async () => {
    vi.mocked(productsRepository.countByCategory).mockResolvedValue(0);
    vi.mocked(categoriesRepository.countByParent).mockResolvedValue(2);

    await expect(deleteCategory(idA)).rejects.toMatchObject({
      statusCode: 409,
      code: "CATEGORY_IN_USE",
      message: expect.stringContaining("2 subcategor"),
    });
  });

  it("names both reasons when both block deletion", async () => {
    vi.mocked(productsRepository.countByCategory).mockResolvedValue(1);
    vi.mocked(categoriesRepository.countByParent).mockResolvedValue(1);

    await expect(deleteCategory(idA)).rejects.toMatchObject({
      statusCode: 409,
      code: "CATEGORY_IN_USE",
      message: expect.stringMatching(/1 product.*1 subcategor/),
    });
  });

  it("deletes when there are zero products and zero subcategories", async () => {
    vi.mocked(productsRepository.countByCategory).mockResolvedValue(0);
    vi.mocked(categoriesRepository.countByParent).mockResolvedValue(0);

    await deleteCategory(idA);

    expect(categorySpecificationsService.deleteForCategory).toHaveBeenCalledWith(idA);
    expect(categoryVariantsService.deleteForCategory).toHaveBeenCalledWith(idA);
    expect(categoriesRepository.deleteById).toHaveBeenCalledWith(idA);
  });
});

describe("updateCategoryStatus", () => {
  it("sets the requested boolean status", async () => {
    vi.mocked(categoriesRepository.updateById).mockResolvedValue({ ...categoryA, status: false });

    await updateCategoryStatus(idA, false);

    expect(categoriesRepository.updateById).toHaveBeenCalledWith(idA, { status: false });
  });

  it("throws CATEGORY_NOT_FOUND when the id doesn't match any category", async () => {
    vi.mocked(categoriesRepository.updateById).mockResolvedValue(null);

    await expect(updateCategoryStatus(idA, false)).rejects.toMatchObject({
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
    });
  });

  it("never touches the product/subcategory delete guard — no guard calls happen at all", async () => {
    vi.mocked(categoriesRepository.updateById).mockResolvedValue({ ...categoryA, status: false });

    await updateCategoryStatus(idA, false);

    expect(productsRepository.countByCategory).not.toHaveBeenCalled();
    expect(categoriesRepository.countByParent).not.toHaveBeenCalled();
  });
});
