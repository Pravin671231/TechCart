import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryRecord } from "@/modules/categories/categories.repository";
import type { CategorySpecificationsRecord } from "../categorySpecifications.repository";
import type { SpecificationGroup } from "../categorySpecifications.model";

vi.mock("../categorySpecifications.repository", () => ({
  findByCategory: vi.fn(),
  replaceGroups: vi.fn(),
  deleteByCategory: vi.fn(),
}));

vi.mock("@/modules/categories/categories.repository", () => ({
  findById: vi.fn(),
}));

vi.mock("@/modules/products/products.repository", () => ({
  countBySpecificationField: vi.fn(),
}));

import * as categorySpecificationsRepository from "../categorySpecifications.repository";
import * as categoriesRepository from "@/modules/categories/categories.repository";
import * as productsRepository from "@/modules/products/products.repository";
import {
  getSpecifications,
  defineSpecifications,
  updateSpecifications,
  deleteForCategory,
  validateProductSpecifications,
} from "../categorySpecifications.service";

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

const groupA: SpecificationGroup = {
  groupName: "Display",
  specifications: [
    { name: "Screen Size", type: "number", unit: "inches", required: true, filterable: true },
    { name: "Resolution", type: "text", required: false, filterable: false },
  ],
};

const groupB: SpecificationGroup = {
  groupName: "Battery",
  specifications: [
    { name: "Capacity", type: "number", unit: "mAh", required: false, filterable: true },
  ],
};

function storedDoc(specificationGroups: SpecificationGroup[]): CategorySpecificationsRecord {
  return { _id: new Types.ObjectId(), category: categoryId, specificationGroups };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getSpecifications", () => {
  it("returns the stored groups when a document exists", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
      storedDoc([groupA]),
    );

    const result = await getSpecifications(categoryId);

    expect(result).toEqual({ category: categoryId, specificationGroups: [groupA] });
  });

  it("returns an empty default when no schema has been defined yet", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(null);

    const result = await getSpecifications(categoryId);

    expect(result).toEqual({ category: categoryId, specificationGroups: [] });
  });

  it("throws CATEGORY_NOT_FOUND when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    await expect(getSpecifications(categoryId)).rejects.toMatchObject({
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
    });
    expect(categorySpecificationsRepository.findByCategory).not.toHaveBeenCalled();
  });
});

describe("defineSpecifications", () => {
  it("persists the groups via replaceGroups", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsRepository.replaceGroups).mockResolvedValue(
      storedDoc([groupA]),
    );

    const result = await defineSpecifications(categoryId, [groupA]);

    expect(categorySpecificationsRepository.replaceGroups).toHaveBeenCalledWith(categoryId, [
      groupA,
    ]);
    expect(result).toEqual({ category: categoryId, specificationGroups: [groupA] });
  });

  it("rejects duplicate groupName across the payload", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);

    await expect(defineSpecifications(categoryId, [groupA, { ...groupA }])).rejects.toMatchObject({
      statusCode: 400,
      code: "DUPLICATE_SPECIFICATION_GROUP",
    });
    expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
  });

  it("rejects duplicate field name within a group", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
    const duplicateFieldGroup: SpecificationGroup = {
      groupName: "Display",
      specifications: [groupA.specifications[0]!, groupA.specifications[0]!],
    };

    await expect(defineSpecifications(categoryId, [duplicateFieldGroup])).rejects.toMatchObject({
      statusCode: 400,
      code: "DUPLICATE_SPECIFICATION_FIELD",
    });
    expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
  });

  it("throws CATEGORY_NOT_FOUND when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    await expect(defineSpecifications(categoryId, [groupA])).rejects.toMatchObject({
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
    });
    expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
  });
});

describe("updateSpecifications", () => {
  it("throws CATEGORY_NOT_FOUND when the category doesn't exist", async () => {
    vi.mocked(categoriesRepository.findById).mockResolvedValue(null);

    await expect(
      updateSpecifications(categoryId, {
        op: "deleteField",
        groupName: "Display",
        name: "Resolution",
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "CATEGORY_NOT_FOUND" });
  });

  describe("renameGroup", () => {
    it("renames an existing group, leaving other groups untouched", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA, groupB]),
      );
      vi.mocked(categorySpecificationsRepository.replaceGroups).mockResolvedValue(
        storedDoc([{ ...groupA, groupName: "Screen" }, groupB]),
      );

      await updateSpecifications(categoryId, {
        op: "renameGroup",
        groupName: "Display",
        newGroupName: "Screen",
      });

      expect(categorySpecificationsRepository.replaceGroups).toHaveBeenCalledWith(categoryId, [
        { ...groupA, groupName: "Screen" },
        groupB,
      ]);
    });

    it("throws SPECIFICATION_GROUP_NOT_FOUND when the group doesn't exist", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );

      await expect(
        updateSpecifications(categoryId, {
          op: "renameGroup",
          groupName: "Nope",
          newGroupName: "Screen",
        }),
      ).rejects.toMatchObject({ statusCode: 404, code: "SPECIFICATION_GROUP_NOT_FOUND" });
      expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
    });

    it("throws DUPLICATE_SPECIFICATION_GROUP when newGroupName collides with an existing group", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA, groupB]),
      );

      await expect(
        updateSpecifications(categoryId, {
          op: "renameGroup",
          groupName: "Display",
          newGroupName: "Battery",
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_SPECIFICATION_GROUP" });
      expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
    });
  });

  describe("deleteGroup", () => {
    it("removes the group when none of its fields are in use", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA, groupB]),
      );
      vi.mocked(productsRepository.countBySpecificationField).mockResolvedValue(0);
      vi.mocked(categorySpecificationsRepository.replaceGroups).mockResolvedValue(
        storedDoc([groupB]),
      );

      await updateSpecifications(categoryId, { op: "deleteGroup", groupName: "Display" });

      expect(categorySpecificationsRepository.replaceGroups).toHaveBeenCalledWith(categoryId, [
        groupB,
      ]);
    });

    it("throws SPECIFICATION_GROUP_NOT_FOUND when the group doesn't exist", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );

      await expect(
        updateSpecifications(categoryId, { op: "deleteGroup", groupName: "Nope" }),
      ).rejects.toMatchObject({ statusCode: 404, code: "SPECIFICATION_GROUP_NOT_FOUND" });
    });

    it("rejects, naming every blocking field, when any field in the group is in use", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );
      vi.mocked(productsRepository.countBySpecificationField).mockImplementation(
        async (_categoryId, _groupName, name) => (name === "Screen Size" ? 2 : 0),
      );

      await expect(
        updateSpecifications(categoryId, { op: "deleteGroup", groupName: "Display" }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "SPECIFICATION_FIELD_IN_USE",
        message: expect.stringContaining("Screen Size"),
      });
      expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
    });
  });

  describe("updateField", () => {
    it("replaces the field in place, leaving other fields untouched", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );
      const updatedField = {
        name: "Screen Size",
        type: "number" as const,
        unit: "in",
        required: true,
        filterable: true,
      };
      vi.mocked(categorySpecificationsRepository.replaceGroups).mockResolvedValue(
        storedDoc([{ ...groupA, specifications: [updatedField, groupA.specifications[1]!] }]),
      );

      await updateSpecifications(categoryId, {
        op: "updateField",
        groupName: "Display",
        name: "Screen Size",
        field: updatedField,
      });

      expect(categorySpecificationsRepository.replaceGroups).toHaveBeenCalledWith(categoryId, [
        { ...groupA, specifications: [updatedField, groupA.specifications[1]] },
      ]);
    });

    it("throws SPECIFICATION_GROUP_NOT_FOUND when the group doesn't exist", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );

      await expect(
        updateSpecifications(categoryId, {
          op: "updateField",
          groupName: "Nope",
          name: "Screen Size",
          field: groupA.specifications[0]!,
        }),
      ).rejects.toMatchObject({ statusCode: 404, code: "SPECIFICATION_GROUP_NOT_FOUND" });
    });

    it("throws SPECIFICATION_FIELD_NOT_FOUND when the field doesn't exist in that group", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );

      await expect(
        updateSpecifications(categoryId, {
          op: "updateField",
          groupName: "Display",
          name: "Nope",
          field: groupA.specifications[0]!,
        }),
      ).rejects.toMatchObject({ statusCode: 404, code: "SPECIFICATION_FIELD_NOT_FOUND" });
    });

    it("throws DUPLICATE_SPECIFICATION_FIELD when renamed to a name already used in the group", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );

      await expect(
        updateSpecifications(categoryId, {
          op: "updateField",
          groupName: "Display",
          name: "Resolution",
          field: { name: "Screen Size", type: "text", required: false, filterable: false },
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_SPECIFICATION_FIELD" });
      expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
    });
  });

  describe("deleteField", () => {
    it("removes the field when it isn't in use", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );
      vi.mocked(productsRepository.countBySpecificationField).mockResolvedValue(0);
      vi.mocked(categorySpecificationsRepository.replaceGroups).mockResolvedValue(
        storedDoc([{ ...groupA, specifications: [groupA.specifications[1]!] }]),
      );

      await updateSpecifications(categoryId, {
        op: "deleteField",
        groupName: "Display",
        name: "Screen Size",
      });

      expect(categorySpecificationsRepository.replaceGroups).toHaveBeenCalledWith(categoryId, [
        { ...groupA, specifications: [groupA.specifications[1]] },
      ]);
    });

    it("throws SPECIFICATION_FIELD_IN_USE naming the blocking count when the field is in use", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );
      vi.mocked(productsRepository.countBySpecificationField).mockResolvedValue(3);

      await expect(
        updateSpecifications(categoryId, {
          op: "deleteField",
          groupName: "Display",
          name: "Screen Size",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "SPECIFICATION_FIELD_IN_USE",
        message: expect.stringContaining("3"),
      });
      expect(categorySpecificationsRepository.replaceGroups).not.toHaveBeenCalled();
    });

    it("throws SPECIFICATION_GROUP_NOT_FOUND when the group doesn't exist", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );

      await expect(
        updateSpecifications(categoryId, {
          op: "deleteField",
          groupName: "Nope",
          name: "Screen Size",
        }),
      ).rejects.toMatchObject({ statusCode: 404, code: "SPECIFICATION_GROUP_NOT_FOUND" });
    });

    it("throws SPECIFICATION_FIELD_NOT_FOUND when the field doesn't exist in that group", async () => {
      vi.mocked(categoriesRepository.findById).mockResolvedValue(categoryStub);
      vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
        storedDoc([groupA]),
      );

      await expect(
        updateSpecifications(categoryId, { op: "deleteField", groupName: "Display", name: "Nope" }),
      ).rejects.toMatchObject({ statusCode: 404, code: "SPECIFICATION_FIELD_NOT_FOUND" });
    });
  });
});

describe("deleteForCategory", () => {
  it("deletes the category's specification document", async () => {
    await deleteForCategory(categoryId);

    expect(categorySpecificationsRepository.deleteByCategory).toHaveBeenCalledWith(categoryId);
  });
});

describe("validateProductSpecifications", () => {
  const groupWithEnum: SpecificationGroup = {
    groupName: "Options",
    specifications: [
      { name: "Color", type: "enum", options: ["Red", "Blue"], required: false, filterable: true },
    ],
  };

  it("accepts specifications that satisfy every rule (required present, types match, enum value valid)", async () => {
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
      storedDoc([groupA, groupWithEnum]),
    );

    await expect(
      validateProductSpecifications(categoryId, [
        { groupName: "Display", values: [{ name: "Screen Size", value: 6.1 }] },
        { groupName: "Options", values: [{ name: "Color", value: "Red" }] },
      ]),
    ).resolves.toBeUndefined();
  });

  it("treats no schema defined as nothing to satisfy — an empty submission passes", async () => {
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(null);

    await expect(validateProductSpecifications(categoryId, [])).resolves.toBeUndefined();
  });

  it("rejects a submission missing a required field, naming it", async () => {
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
      storedDoc([groupA]),
    );

    await expect(
      validateProductSpecifications(categoryId, [
        { groupName: "Display", values: [{ name: "Resolution", value: "1080p" }] },
      ]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "SPECIFICATION_VALIDATION_FAILED",
      message: expect.stringContaining("Screen Size"),
    });
  });

  it("rejects a submitted field name not in the schema, naming it", async () => {
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
      storedDoc([groupA]),
    );

    await expect(
      validateProductSpecifications(categoryId, [
        {
          groupName: "Display",
          values: [
            { name: "Screen Size", value: 6.1 },
            { name: "Weight", value: 150 },
          ],
        },
      ]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "SPECIFICATION_VALIDATION_FAILED",
      message: expect.stringContaining("Weight"),
    });
  });

  it("rejects a value whose type doesn't match the field's declared type", async () => {
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
      storedDoc([groupA]),
    );

    await expect(
      validateProductSpecifications(categoryId, [
        { groupName: "Display", values: [{ name: "Screen Size", value: "not a number" }] },
      ]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "SPECIFICATION_VALIDATION_FAILED",
      message: expect.stringContaining("Screen Size"),
    });
  });

  it("rejects an enum value outside its declared options", async () => {
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
      storedDoc([groupWithEnum]),
    );

    await expect(
      validateProductSpecifications(categoryId, [
        { groupName: "Options", values: [{ name: "Color", value: "Green" }] },
      ]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "SPECIFICATION_VALIDATION_FAILED",
      message: expect.stringContaining("Color"),
    });
  });

  it("reports every offending field in one error, not just the first", async () => {
    vi.mocked(categorySpecificationsRepository.findByCategory).mockResolvedValue(
      storedDoc([groupA]),
    );

    await expect(
      validateProductSpecifications(categoryId, [
        { groupName: "Display", values: [{ name: "Unknown", value: "x" }] },
      ]),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Screen Size.*Unknown|Unknown.*Screen Size/s),
    });
  });
});
