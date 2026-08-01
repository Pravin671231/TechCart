import type { CategorySchema } from "@/features/product-catalog/product-form/types";

// The only category on offer today — Specifications/Variant-types don't have a
// real schema editor yet (still placeholder pages), so this stands in for the
// category-driven schema FR-CAT-033/FR-CAT-038 describe.
export const mockCategorySchema: CategorySchema = {
  id: "electronics-smartphones",
  label: "Electronics > Smartphones",
  specGroups: [
    {
      groupName: "Display",
      fields: [
        { name: "Screen Size", type: "number", unit: "in", required: true },
        { name: "Resolution", type: "text", required: false },
      ],
    },
    {
      groupName: "Performance",
      fields: [
        { name: "RAM", type: "enum", options: ["4GB", "6GB", "8GB", "12GB"], required: true },
        { name: "Processor", type: "text", required: false },
      ],
    },
    {
      groupName: "Connectivity",
      fields: [{ name: "5G", type: "boolean", required: false }],
    },
  ],
  variantAxes: [
    { name: "Colour", code: "colour", type: "color", options: ["Black", "Silver", "Blue"] },
    { name: "Storage", code: "storage", type: "select", options: ["128GB", "256GB", "512GB"] },
  ],
};

export const mockBrandOptions = [
  "Brand A",
  "Brand B",
  "Brand C",
  "Brand D",
  "Brand E",
  "Brand F",
  "Brand G",
  "Brand H",
].map((brand) => ({ value: brand, label: brand }));

export const mockCategoryOptions = [{ value: mockCategorySchema.id, label: mockCategorySchema.label }];
