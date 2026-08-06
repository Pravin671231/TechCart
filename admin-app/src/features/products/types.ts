export type ProductStatus = "draft" | "published" | "archived";

export interface ProductImage {
  url: string;
  alt?: string;
  isPrimary: boolean;
}

export interface ProductSpecificationValue {
  name: string;
  value: string | number | boolean;
}

export interface ProductSpecificationGroup {
  groupName: string;
  values: ProductSpecificationValue[];
}

export interface ProductVariantAttribute {
  name: string;
  value: string;
}

export interface ProductVariant {
  _id: string;
  sku: string;
  attributes: ProductVariantAttribute[];
  images: ProductImage[];
  mrp: number;
  discount: number;
  sellingPrice: number;
  stock: number;
  weight?: number;
  active: boolean;
}

// brand/category are raw ids here, not populated — the admin product reads
// (unlike buyer-app's public product endpoints) never .populate() them, so
// name/slug are resolved client-side against the already-fetched brands/
// categories lists, the same convention CategoryList.tsx's `nameById`
// already established for a category's own parent name.
export interface Product {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  brand: string;
  category: string;
  images: ProductImage[];
  specifications: ProductSpecificationGroup[];
  variants: ProductVariant[];
  mrp: number;
  discount: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  isFeatured: boolean;
  status: ProductStatus;
  metaTitle?: string;
  metaDescription?: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProductSort = "-createdAt" | "createdAt" | "name" | "-name" | "mrp" | "-mrp" | "stock" | "-stock";

// Request-side image shape — distinct from ProductImage (the response
// shape): the backend only ever accepts a freshly presigned/consumed
// objectKey, never a url, and never returns objectKey back once consumed.
export interface ProductImageInput {
  objectKey: string;
  alt?: string;
  isPrimary?: boolean;
}

export interface CreateProductInput {
  name: string;
  description: string;
  sku: string;
  brand: string;
  category: string;
  images: ProductImageInput[];
  specifications?: ProductSpecificationGroup[];
  mrp: number;
  discount?: number;
  stock: number;
  lowStockThreshold?: number;
  isFeatured?: boolean;
  metaTitle?: string;
  metaDescription?: string;
}

// sku is immutable after create (FR-CAT-004) — omitted entirely, not just
// optional, so a client-submitted sku on update is a type error, not just
// silently ignored.
export type UpdateProductInput = Partial<Omit<CreateProductInput, "sku">>;

export interface ProductVariantAttributeInput {
  name: string;
  value: string;
}

export interface AddVariantInput {
  sku: string;
  attributes: ProductVariantAttributeInput[];
  images?: ProductImageInput[];
  mrp: number;
  discount?: number;
  stock: number;
  weight?: number;
}

export type UpdateVariantInput = Partial<AddVariantInput> & { active?: boolean };
