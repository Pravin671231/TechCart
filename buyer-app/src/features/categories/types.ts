export type PublicCategory = {
  _id: string;
  name: string;
  slug: string;
  parentCategory: string | null;
  sortOrder: number;
  image?: { url: string; alt?: string };
  metaTitle: string;
  metaDescription: string;
};

// Issue #326 — GET /api/categories/:slug/filters (FR-CAT-101).
export type CategoryFilterBrand = {
  _id: string;
  name: string;
  slug: string;
  productCount: number;
};

export type CategoryFilterSpec = {
  name: string;
  unit: string | null;
  type: "enum" | "boolean" | "number";
  options?: string[];
  min?: number;
  max?: number;
};

export type CategoryFilterAxis = {
  name: string;
  code: string;
  type: string;
  options: { label: string; value: string }[];
};

export type CategoryFilterOptions = {
  category: { _id: string; name: string; slug: string };
  brands: CategoryFilterBrand[];
  priceRange: { min: number; max: number } | null;
  specifications: CategoryFilterSpec[];
  variantAxes: CategoryFilterAxis[];
};
