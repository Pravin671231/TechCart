import { api, unwrapData, unwrapList } from "@/store/api";
import type { ApiSuccessEnvelope, ApiSuccessListEnvelope, Pagination } from "@/store/api";
import type { Product, ProductSort, ProductStatus } from "./types";

export interface ListProductsParams {
  page?: number;
  limit?: number;
  sort?: ProductSort;
  search?: string;
  status?: ProductStatus;
  lowStock?: boolean;
}

export interface UpdateProductStatusArgs {
  id: string;
  status: ProductStatus;
}

export interface UpdateProductStockArgs {
  id: string;
  stock: number;
}

export const productsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProducts: build.query<{ items: Product[]; pagination: Pagination }, ListProductsParams | void>({
      query: (params) => ({
        url: "/products",
        params: {
          page: params?.page,
          limit: params?.limit,
          sort: params?.sort,
          search: params?.search || undefined,
          status: params?.status,
          lowStock: params?.lowStock ? "true" : undefined,
        },
      }),
      transformResponse: (response: ApiSuccessListEnvelope<Product>) => unwrapList(response),
      providesTags: ["Product"],
    }),
    getProduct: build.query<Product, string>({
      query: (id) => ({ url: `/products/${id}` }),
      transformResponse: (response: ApiSuccessEnvelope<Product>) => unwrapData(response),
      providesTags: ["Product"],
    }),
    updateProductStatus: build.mutation<Product, UpdateProductStatusArgs>({
      query: ({ id, status }) => ({ url: `/products/${id}/status`, method: "PATCH", body: { status } }),
      transformResponse: (response: ApiSuccessEnvelope<Product>) => unwrapData(response),
      invalidatesTags: ["Product"],
    }),
    updateProductStock: build.mutation<Product, UpdateProductStockArgs>({
      query: ({ id, stock }) => ({ url: `/products/${id}/stock`, method: "PATCH", body: { stock } }),
      transformResponse: (response: ApiSuccessEnvelope<Product>) => unwrapData(response),
      invalidatesTags: ["Product"],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useUpdateProductStatusMutation,
  useUpdateProductStockMutation,
} = productsApi;
