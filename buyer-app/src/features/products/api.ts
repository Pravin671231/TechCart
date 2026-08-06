import { api } from "@/store/api";
import type {
  GetCategoryProductsArgs,
  GetProductsArgs,
  GetProductsResult,
  GetSearchProductsArgs,
  PublicProductDetail,
  PublicProductListItem,
} from "./types";

export const productsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<GetProductsResult, GetProductsArgs>({
      query: ({ page, sort }) => ({ url: "/api/products", params: { page, sort } }),
      transformResponse: (response: unknown, meta): GetProductsResult => {
        if (!meta?.pagination) {
          throw new Error("Expected pagination metadata on a product list response.");
        }
        return { items: response as PublicProductListItem[], pagination: meta.pagination };
      },
      providesTags: ["Product"],
    }),
    getCategoryProducts: builder.query<GetProductsResult, GetCategoryProductsArgs>({
      query: ({ slug, page, sort, brand, minPrice, maxPrice, inStock, onSale }) => ({
        url: `/api/categories/${slug}/products`,
        params: {
          page,
          sort,
          brand: brand && brand.length > 0 ? brand : undefined,
          minPrice,
          maxPrice,
          // Backend only accepts the literal string "true"; an unchecked box
          // must omit the key entirely, never send "false".
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
  }),
});

export const {
  useGetProductsQuery,
  useGetCategoryProductsQuery,
  useSearchProductsQuery,
  useGetProductBySlugQuery,
} = productsApi;
