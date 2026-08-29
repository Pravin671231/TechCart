import type { Pagination } from "@/store/api";

export type ProductBrandRef = { _id: string; name: string; slug: string };
export type ProductImageRef = { url: string; alt?: string };
// Issue #192/M10.4 (FR-INV-007) — reinstated as a 2-state enum (the old
// "low_stock" state predates Issue #102, which removed inventory tracking
// system-wide; Issue #189 reinstated it backend-side as strictly 2-state).
export type ProductAvailability = "out_of_stock" | "in_stock";
export type CardSpecification = {
  name: string;
  value: string | number | boolean;
  unit: string | null;
};

export type PublicProductListItem = {
  _id: string;
  name: string;
  slug: string;
  brand: ProductBrandRef;
  primaryImage?: ProductImageRef;
  mrp: number;
  discount: number;
  sellingPrice: number;
  // Best state across every active variant (FR-INV-007). Absent on the same
  // zero-active-variant edge case the price fields above are.
  availability?: ProductAvailability;
  // The default (lowest-price active) variant's id — what a card's add-to-cart
  // control acts on (M4, FR-CART-021). Absent when the product has no active
  // variant.
  defaultVariantId?: string;
  isFeatured: boolean;
  cardSpecifications: CardSpecification[];
};

// Home never sends `q`, so relevance is intentionally excluded — the mock's
// own caption: "relevance (search only)".
export type ProductSort = "price_asc" | "price_desc" | "newest";

export type GetProductsArgs = { page: number; sort: ProductSort };
export type GetProductsResult = { items: PublicProductListItem[]; pagination: Pagination };

export type CategoryProductFilters = {
  brand?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
};

export type GetCategoryProductsArgs = {
  slug: string;
  page: number;
  sort: ProductSort;
} & CategoryProductFilters;

// Relevance only means something alongside a keyword — search is the only
// screen that offers it, and it's the default there (FR-CAT-075).
export type SearchProductSort = "relevance" | ProductSort;

export type SearchProductFilters = CategoryProductFilters & { category?: string };

export type GetSearchProductsArgs = {
  q: string;
  page: number;
  sort: SearchProductSort;
} & SearchProductFilters;

export type ProductVariantAttribute = { name: string; value: string };

export type PublicProductVariant = {
  _id: string;
  sku: string;
  attributes: ProductVariantAttribute[];
  images: ProductImageRef[];
  mrp: number;
  discount: number;
  sellingPrice: number;
  availability: ProductAvailability;
  weight?: number;
};

export type ProductSpecificationValue = { name: string; value: string | number | boolean };
export type ProductSpecificationGroup = {
  groupName: string;
  values: ProductSpecificationValue[];
};

export type PublicProductDetail = {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  brand: ProductBrandRef;
  category: ProductBrandRef;
  images: ProductImageRef[];
  mrp: number;
  discount: number;
  sellingPrice: number;
  // Issue #192/M10.4 — no top-level availability exists on the real detail
  // response; it's per-variant only (see PublicProductVariant.availability
  // above) — there's no single "the product's" state once a product can
  // carry more than one purchasable unit.
  isFeatured: boolean;
  specifications: ProductSpecificationGroup[];
  hasVariants: boolean;
  defaultVariantId?: string;
  variants: PublicProductVariant[];
  metaTitle: string;
  metaDescription: string;
};
