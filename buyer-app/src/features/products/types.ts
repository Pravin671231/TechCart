import type { Pagination } from "@/store/api";

export type ProductBrandRef = { _id: string; name: string; slug: string };
export type ProductImageRef = { url: string; alt?: string };
export type ProductAvailability = "out_of_stock" | "low_stock" | "in_stock";
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
  availability: ProductAvailability;
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
