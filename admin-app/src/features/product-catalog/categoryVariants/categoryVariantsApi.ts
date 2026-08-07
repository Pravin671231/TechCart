import { api } from "@/app/api/baseApi";
import { unwrapData } from "@/app/api/apiResponse";
import type { ApiSuccessEnvelope } from "@/app/api/api.types";
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
      query: (categoryId) => ({ url: `/categories/${categoryId}/variant-types` }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryVariantsView>) => unwrapData(response),
      providesTags: ["CategoryVariant"],
    }),
    replaceCategoryVariants: build.mutation<CategoryVariantsView, ReplaceCategoryVariantsArgs>({
      query: ({ categoryId, variants }) => ({
        url: `/categories/${categoryId}/variant-types`,
        method: "PUT",
        body: { variants },
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryVariantsView>) => unwrapData(response),
      invalidatesTags: ["CategoryVariant"],
    }),
    patchCategoryVariants: build.mutation<CategoryVariantsView, PatchCategoryVariantsArgs>({
      query: ({ categoryId, operation }) => ({
        url: `/categories/${categoryId}/variant-types`,
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
