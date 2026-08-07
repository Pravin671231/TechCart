import { api } from "@/app/api/baseApi";
import { unwrapData } from "@/app/api/apiResponse";
import type { ApiSuccessEnvelope } from "@/app/api/api.types";
import { PRODUCT_CATALOG_ENDPOINTS } from "../endpoints";
import type { Category, CategoryListItem, CreateCategoryInput, UpdateCategoryInput } from "./types";

export interface ListCategoriesParams {
  search?: string;
}

export interface UpdateCategoryArgs {
  id: string;
  patch: UpdateCategoryInput;
}

export interface UpdateCategoryStatusArgs {
  id: string;
  status: boolean;
}

export const categoriesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCategories: build.query<CategoryListItem[], ListCategoriesParams | void>({
      query: (params) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categories.list,
        params: params?.search ? { search: params.search } : undefined,
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryListItem[]>) => unwrapData(response),
      providesTags: ["Category"],
    }),
    createCategory: build.mutation<Category, CreateCategoryInput>({
      query: (body) => ({ url: PRODUCT_CATALOG_ENDPOINTS.categories.list, method: "POST", body }),
      transformResponse: (response: ApiSuccessEnvelope<Category>) => unwrapData(response),
      invalidatesTags: ["Category"],
    }),
    updateCategory: build.mutation<Category, UpdateCategoryArgs>({
      query: ({ id, patch }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categories.detail(id),
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (response: ApiSuccessEnvelope<Category>) => unwrapData(response),
      invalidatesTags: ["Category"],
    }),
    updateCategoryStatus: build.mutation<Category, UpdateCategoryStatusArgs>({
      query: ({ id, status }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categories.status(id),
        method: "PATCH",
        body: { status },
      }),
      transformResponse: (response: ApiSuccessEnvelope<Category>) => unwrapData(response),
      invalidatesTags: ["Category"],
    }),
    deleteCategory: build.mutation<null, string>({
      query: (id) => ({ url: PRODUCT_CATALOG_ENDPOINTS.categories.detail(id), method: "DELETE" }),
      transformResponse: (response: ApiSuccessEnvelope<null>) => unwrapData(response),
      invalidatesTags: ["Category"],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useUpdateCategoryStatusMutation,
  useDeleteCategoryMutation,
} = categoriesApi;
