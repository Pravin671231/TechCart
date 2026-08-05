import { api } from "@/store/api";
import type { GetProductsArgs, GetProductsResult, PublicProductListItem } from "./types";

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
  }),
});

export const { useGetProductsQuery } = productsApi;
