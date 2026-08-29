import { api } from "@/store/api";
import type {
  CategoryProductFilters,
  GetCategoryProductsArgs,
  GetProductsArgs,
  GetProductsResult,
  GetSearchProductsArgs,
  PublicProductDetail,
  PublicProductListItem,
} from "./types";

function transformListResponse(
  response: unknown,
  meta: { pagination?: GetProductsResult["pagination"] } | undefined,
): GetProductsResult {
  if (!meta?.pagination) {
    throw new Error("Expected pagination metadata on a product list response.");
  }
  return { items: response as PublicProductListItem[], pagination: meta.pagination };
}

// Infinite-scroll cache behaviour (Issue #326): all pages of one
// sort+filter combination collapse into a single cache entry — `page` is
// dropped from the serialized key, `forceRefetch` fires the next-page
// request, and `merge` appends. A sort or filter change produces a
// different key, so it naturally starts a fresh list at page 1.
function serializeInfiniteArgs(args: { endpointName: string; queryArgs: unknown }): string {
  const { page: _page, ...rest } = (args.queryArgs ?? {}) as Record<string, unknown>;
  return `${args.endpointName}(${JSON.stringify(rest)})`;
}

function mergeInfinitePages(
  currentCache: GetProductsResult,
  incoming: GetProductsResult,
  { arg }: { arg: { page: number } },
): void {
  if (arg.page <= 1) {
    currentCache.items = incoming.items;
  } else {
    const seen = new Set(currentCache.items.map((product) => product._id));
    currentCache.items.push(...incoming.items.filter((product) => !seen.has(product._id)));
  }
  currentCache.pagination = incoming.pagination;
}

// Expand a CategoryProductFilters selection into the flat query-param object
// fetchBaseQuery serializes — spec facets use qs bracket notation
// (`spec[RAM]=8GB`, `spec[ScreenSize][min]=6`), matching backend's
// "extended" query parser (Issue #36).
function categoryFilterParams(filters: CategoryProductFilters): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  if (filters.brand && filters.brand.length > 0) params.brand = filters.brand;
  if (filters.minPrice !== undefined) params.minPrice = String(filters.minPrice);
  if (filters.maxPrice !== undefined) params.maxPrice = String(filters.maxPrice);
  // Backend only accepts the literal string "true"; an unchecked box must
  // omit the key entirely, never send "false".
  if (filters.inStock) params.inStock = "true";
  if (filters.onSale) params.onSale = "true";
  if (filters.attributeName !== undefined && filters.attributeValue !== undefined) {
    params.attributeName = filters.attributeName;
    params.attributeValue = filters.attributeValue;
  }
  for (const [name, selection] of Object.entries(filters.spec ?? {})) {
    if (typeof selection === "string") {
      params[`spec[${name}]`] = selection;
    } else {
      if (selection.min !== undefined) params[`spec[${name}][min]`] = String(selection.min);
      if (selection.max !== undefined) params[`spec[${name}][max]`] = String(selection.max);
    }
  }
  return params;
}

export const productsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<GetProductsResult, GetProductsArgs>({
      query: ({ page, sort }) => ({ url: "/api/products", params: { page, sort } }),
      transformResponse: (response: unknown, meta): GetProductsResult =>
        transformListResponse(response, meta),
      serializeQueryArgs: serializeInfiniteArgs,
      merge: mergeInfinitePages,
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["Product"],
    }),
    getCategoryProducts: builder.query<GetProductsResult, GetCategoryProductsArgs>({
      query: ({ slug, page, sort, ...filters }) => ({
        url: `/api/categories/${slug}/products`,
        params: { page, sort, ...categoryFilterParams(filters) },
      }),
      transformResponse: (response: unknown, meta): GetProductsResult =>
        transformListResponse(response, meta),
      serializeQueryArgs: serializeInfiniteArgs,
      merge: mergeInfinitePages,
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["Product"],
    }),
    searchProducts: builder.query<GetProductsResult, GetSearchProductsArgs>({
      query: ({ q, page, sort, category, brand, minPrice, maxPrice, inStock, onSale }) => ({
        url: "/api/products",
        params: {
          q,
          page,
          sort,
          category,
          brand: brand && brand.length > 0 ? brand : undefined,
          minPrice,
          maxPrice,
          inStock: inStock ? "true" : undefined,
          onSale: onSale ? "true" : undefined,
        },
      }),
      transformResponse: (response: unknown, meta): GetProductsResult => {
        if (!meta?.pagination) {
          throw new Error("Expected pagination metadata on a product list response.");
        }
        return { items: response as PublicProductListItem[], pagination: meta.pagination };
      },
      providesTags: ["Product"],
    }),
    getProductBySlug: builder.query<PublicProductDetail, string>({
      query: (slug) => ({ url: `/api/products/${slug}` }),
      transformResponse: (response: unknown): PublicProductDetail =>
        response as PublicProductDetail,
      providesTags: ["Product"],
    }),
    // Issue #322 — the header search-bar suggestions dropdown. A slim keyword
    // query capped at 5 results; the pagination envelope is ignored (unlike
    // the list endpoints above, which thread it through `meta`).
    getProductSuggestions: builder.query<PublicProductListItem[], string>({
      query: (q) => ({ url: "/api/products", params: { q, limit: 5 } }),
      transformResponse: (response: unknown): PublicProductListItem[] =>
        response as PublicProductListItem[],
      providesTags: ["Product"],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetCategoryProductsQuery,
  useSearchProductsQuery,
  useGetProductBySlugQuery,
  useGetProductSuggestionsQuery,
} = productsApi;
