import { api, unwrapData } from "@/store/api";
import type { ApiSuccessEnvelope } from "@/store/api";
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
        url: "/categories",
        params: params?.search ? { search: params.search } : undefined,
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryListItem[]>) => unwrapData(response),
      providesTags: ["Category"],
    }),
    createCategory: build.mutation<Category, CreateCategoryInput>({
      query: (body) => ({ url: "/categories", method: "POST", body }),
      transformResponse: (response: ApiSuccessEnvelope<Category>) => unwrapData(response),
      invalidatesTags: ["Category"],
    }),
    updateCategory: build.mutation<Category, UpdateCategoryArgs>({
      query: ({ id, patch }) => ({ url: `/categories/${id}`, method: "PATCH", body: patch }),
      transformResponse: (response: ApiSuccessEnvelope<Category>) => unwrapData(response),
      invalidatesTags: ["Category"],
    }),
    updateCategoryStatus: build.mutation<Category, UpdateCategoryStatusArgs>({
      query: ({ id, status }) => ({
        url: `/categories/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      transformResponse: (response: ApiSuccessEnvelope<Category>) => unwrapData(response),
      invalidatesTags: ["Category"],
    }),
    deleteCategory: build.mutation<null, string>({
      query: (id) => ({ url: `/categories/${id}`, method: "DELETE" }),
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
