import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryRecord } from "@/modules/product-catalog/features/categories/categories.repository";
import type { CategoryVariantsRecord } from "../categoryVariants.repository";
import type { VariantAxis } from "../categoryVariants.model";

vi.mock("../categoryVariants.repository", () => ({
  findByCategory: vi.fn(),
  replaceAxes: vi.fn(),
  deleteByCategory: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/categories/categories.repository", () => ({
  findById: vi.fn(),
}));

import * as categoryVariantsRepository from "../categoryVariants.repository";
import * as categoriesRepository from "@/modules/product-catalog/features/categories/categories.repository";
import {
  getVariantAxes,
  defineVariantAxes,
  updateVariantAxes,
  deleteForCategory,
} from "../categoryVariants.service";

const categoryId = new Types.ObjectId();

const categoryStub: CategoryRecord = {
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

function storedDoc(variants: VariantAxis[]): CategoryVariantsRecord {
  return { _id: new Types.ObjectId(), category: categoryId, variants };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getVariantAxes", () => {
  it("returns the stored axes when a document exists", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(storedDoc([colorAxis]));

    const result = await getVariantAxes(categoryId);

    expect(result).toEqual({ category: categoryId, variants: [colorAxis] });
  });

  it("returns an empty default when no axes have been defined yet", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(null);

    const result = await getVariantAxes(categoryId);

    expect(result).toEqual({ category: categoryId, variants: [] });
  });

  it("throws CATEGORY_NOT_FOUND when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    await expect(getVariantAxes(categoryId)).rejects.toMatchObject({
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
    });
    expect(categoryVariantsRepository.findByCategory).not.toHaveBeenCalled();
  });
});

describe("defineVariantAxes", () => {
  it("persists the axes via replaceAxes", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categoryVariantsRepository.replaceAxes).mockResolvedValue(
      storedDoc([colorAxis, sizeAxis]),
    );

    const result = await defineVariantAxes(categoryId, [colorAxis, sizeAxis]);

    expect(categoryVariantsRepository.replaceAxes).toHaveBeenCalledWith(categoryId, [
      colorAxis,
      sizeAxis,
    ]);
    expect(result).toEqual({ category: categoryId, variants: [colorAxis, sizeAxis] });
  });

  it("rejects duplicate axis codes across the payload", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    await expect(
      defineVariantAxes(categoryId, [colorAxis, { ...colorAxis }]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "DUPLICATE_VARIANT_AXIS",
    });
    expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
  });

  it("throws CATEGORY_NOT_FOUND when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    await expect(defineVariantAxes(categoryId, [colorAxis])).rejects.toMatchObject({
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
    });
    expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
  });
});

describe("updateVariantAxes", () => {
  it("throws CATEGORY_NOT_FOUND when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    await expect(
      updateVariantAxes(categoryId, { op: "deleteAxis", code: "color" }),
    ).rejects.toMatchObject({ statusCode: 404, code: "CATEGORY_NOT_FOUND" });
  });

  describe("updateAxis", () => {
    it("replaces the axis in place, leaving other axes untouched", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(
        storedDoc([colorAxis, sizeAxis]),
      );
      const renamedAxis: VariantAxis = { ...colorAxis, name: "Colour" };
      vi.mocked(categoryVariantsRepository.replaceAxes).mockResolvedValue(
        storedDoc([renamedAxis, sizeAxis]),
      );

      await updateVariantAxes(categoryId, { op: "updateAxis", code: "color", axis: renamedAxis });

      expect(categoryVariantsRepository.replaceAxes).toHaveBeenCalledWith(categoryId, [
        renamedAxis,
        sizeAxis,
      ]);
    });

    it("allows changing the code itself when the new code doesn't collide", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(
        storedDoc([colorAxis, sizeAxis]),
      );
      const recoded: VariantAxis = { ...colorAxis, code: "hue" };
      vi.mocked(categoryVariantsRepository.replaceAxes).mockResolvedValue(
        storedDoc([recoded, sizeAxis]),
      );

      await updateVariantAxes(categoryId, { op: "updateAxis", code: "color", axis: recoded });

      expect(categoryVariantsRepository.replaceAxes).toHaveBeenCalledWith(categoryId, [
        recoded,
        sizeAxis,
      ]);
    });

    it("throws VARIANT_AXIS_NOT_FOUND when the axis doesn't exist", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(
        storedDoc([colorAxis]),
      );

      await expect(
        updateVariantAxes(categoryId, { op: "updateAxis", code: "nope", axis: colorAxis }),
      ).rejects.toMatchObject({ statusCode: 404, code: "VARIANT_AXIS_NOT_FOUND" });
      expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
    });

    it("throws DUPLICATE_VARIANT_AXIS when recoded to a code already used by another axis", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(
        storedDoc([colorAxis, sizeAxis]),
      );

      await expect(
        updateVariantAxes(categoryId, {
          op: "updateAxis",
          code: "color",
          axis: { ...colorAxis, code: "size" },
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_VARIANT_AXIS" });
      expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
    });
  });

  describe("deleteAxis", () => {
    it("removes the axis unconditionally, with no in-use check of any kind", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(
        storedDoc([colorAxis, sizeAxis]),
      );
      vi.mocked(categoryVariantsRepository.replaceAxes).mockResolvedValue(storedDoc([sizeAxis]));

      await updateVariantAxes(categoryId, { op: "deleteAxis", code: "color" });

      expect(categoryVariantsRepository.replaceAxes).toHaveBeenCalledWith(categoryId, [sizeAxis]);
    });

    it("throws VARIANT_AXIS_NOT_FOUND when the axis doesn't exist", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categoryVariantsRepository.findByCategory).mockResolvedValue(
        storedDoc([colorAxis]),
      );

      await expect(
        updateVariantAxes(categoryId, { op: "deleteAxis", code: "nope" }),
      ).rejects.toMatchObject({ statusCode: 404, code: "VARIANT_AXIS_NOT_FOUND" });
      expect(categoryVariantsRepository.replaceAxes).not.toHaveBeenCalled();
    });
  });
});

describe("deleteForCategory", () => {
  it("deletes the category's variant-type document", async () => {
    await deleteForCategory(categoryId);

    expect(categoryVariantsRepository.deleteByCategory).toHaveBeenCalledWith(categoryId);
  });
});
