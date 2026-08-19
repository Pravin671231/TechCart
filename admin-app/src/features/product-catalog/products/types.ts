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
  weight?: number;
  active: boolean;
}

// brand/category are raw ids here, not populated — the admin product reads
// (unlike buyer-app's public product endpoints) never .populate() them, so
// name/slug are resolved client-side against the already-fetched brands/
// categories lists, the same convention CategoryList.tsx's `nameById`
// already established for a category's own parent name.
//
// Every sellable, priced, imaged unit is a variant (Issue #102) — the
// product itself carries none of sku/images/mrp/discount/sellingPrice/
// stock/lowStockThreshold. Stock tracking is removed system-wide, not
// moved to the variant either.
export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  category: string;
  specifications: ProductSpecificationGroup[];
  variants: ProductVariant[];
  isFeatured: boolean;
  status: ProductStatus;
  metaTitle?: string;
  metaDescription?: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Matches PRODUCT_SORT_FIELDS (backend) — mrp/stock are no longer
// sortable fields since #102 removed them from the product. Kept as one
// combined string at the UI layer; productsApi.ts's getProducts splits it
// into ?sortBy=/?orderBy= (Issue #104) when building the request.
export type ProductSort = "-createdAt" | "createdAt" | "name" | "-name";

// Request-side image shape — distinct from ProductImage (the response
// shape): the backend only ever accepts a freshly presigned/consumed
// objectKey, never a url, and never returns objectKey back once consumed.
export interface ProductImageInput {
  objectKey: string;
  alt?: string;
  isPrimary?: boolean;
}

// Matches createProductSchema/updateProductSchema (backend) exactly — a
// product create/update is just its own metadata plus
// specifications/SEO/isFeatured (Issue #102); no sku/images/pricing/stock.
export interface CreateProductInput {
  name: string;
  description: string;
  brand: string;
  category: string;
  specifications?: ProductSpecificationGroup[];
  isFeatured?: boolean;
  metaTitle?: string;
  metaDescription?: string;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface ProductVariantAttributeInput {
  name: string;
  value: string;
}

export interface AddVariantInput {
  sku: string;
  attributes: ProductVariantAttributeInput[];
  images: ProductImageInput[];
  mrp: number;
  discount?: number;
  weight?: number;
}

export type UpdateVariantInput = Partial<AddVariantInput> & { active?: boolean };
