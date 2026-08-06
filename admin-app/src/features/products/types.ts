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
