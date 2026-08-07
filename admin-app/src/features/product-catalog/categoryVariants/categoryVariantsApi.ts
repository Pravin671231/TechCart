import { api } from "@/app/api/baseApi";
import { unwrapData } from "@/app/api/apiResponse";
import type { ApiSuccessEnvelope } from "@/app/api/api.types";
import { PRODUCT_CATALOG_ENDPOINTS } from "../endpoints";
import type { CategoryVariantsView, VariantAxis, VariantAxisPatchOperation } from "./types";

export interface ReplaceCategoryVariantsArgs {
  categoryId: string;
  variants: VariantAxis[];
}

export interface PatchCategoryVariantsArgs {
  categoryId: string;
  operation: VariantAxisPatchOperation;
}

export const categoryVariantsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCategoryVariants: build.query<CategoryVariantsView, string>({
      query: (categoryId) => ({ url: PRODUCT_CATALOG_ENDPOINTS.categoryVariants.detail(categoryId) }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryVariantsView>) => unwrapData(response),
      providesTags: ["CategoryVariant"],
    }),
    replaceCategoryVariants: build.mutation<CategoryVariantsView, ReplaceCategoryVariantsArgs>({
      query: ({ categoryId, variants }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categoryVariants.detail(categoryId),
        method: "PUT",
        body: { variants },
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryVariantsView>) => unwrapData(response),
      invalidatesTags: ["CategoryVariant"],
    }),
    patchCategoryVariants: build.mutation<CategoryVariantsView, PatchCategoryVariantsArgs>({
      query: ({ categoryId, operation }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categoryVariants.detail(categoryId),
        method: "PATCH",
        body: operation,
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryVariantsView>) => unwrapData(response),
      invalidatesTags: ["CategoryVariant"],
    }),
  }),
});

export const {
  useGetCategoryVariantsQuery,
  useReplaceCategoryVariantsMutation,
  usePatchCategoryVariantsMutation,
} = categoryVariantsApi;
