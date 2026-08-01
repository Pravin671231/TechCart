export type StepId = "info" | "media" | "pricing" | "specs" | "variants" | "seo";

export const stepOrder: StepId[] = ["info", "media", "pricing", "specs", "variants", "seo"];

export const stepLabels: Record<StepId, string> = {
  info: "Product Information",
  media: "Upload Media",
  pricing: "Pricing & Inventory",
  specs: "Specifications",
  variants: "Variants",
  seo: "SEO",
};

export type SpecFieldType = "text" | "number" | "boolean" | "enum";

export type SpecField = {
  name: string;
  type: SpecFieldType;
  unit?: string;
  options?: string[];
  required: boolean;
};

export type SpecGroup = {
  groupName: string;
  fields: SpecField[];
};

export type VariantAxisType = "text" | "select" | "color" | "number";

export type VariantAxis = {
  name: string;
  code: string;
  type: VariantAxisType;
  options: string[];
};

export type CategorySchema = {
  id: string;
  label: string;
  specGroups: SpecGroup[];
  variantAxes: VariantAxis[];
};

export type ProductImage = {
  id: string;
  url: string;
  alt?: string;
  isPrimary: boolean;
};

export type VariantRow = {
  id: string;
  attributes: Record<string, string>;
  sku: string;
  mrp: number;
  discount: number;
  stock: number;
  weight?: number;
  active: boolean;
  images: ProductImage[];
};
