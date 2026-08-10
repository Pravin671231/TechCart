import { api } from "@/app/api/baseApi";
import { unwrapData } from "@/app/api/apiResponse";
import { notifyApiError, notifyApiSuccess } from "@/app/api/apiToast";
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

const PATCH_MESSAGES: Record<
  VariantAxisPatchOperation["op"],
  { success: string; errorFallback: string }
> = {
  updateAxis: { success: "Axis updated.", errorFallback: "Unable to update the axis." },
  deleteAxis: { success: "Axis deleted.", errorFallback: "Unable to delete the axis." },
};

export const categoryVariantsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCategoryVariants: build.query<CategoryVariantsView, string>({
      query: (categoryId) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categoryVariants.detail(categoryId),
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryVariantsView>) =>
        unwrapData(response),
      providesTags: ["CategoryVariant"],
    }),
    replaceCategoryVariants: build.mutation<CategoryVariantsView, ReplaceCategoryVariantsArgs>({
      query: ({ categoryId, variants }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categoryVariants.detail(categoryId),
        method: "PUT",
        body: { variants },
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryVariantsView>) =>
        unwrapData(response),
      invalidatesTags: ["CategoryVariant"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Variant axes saved.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to save the variant axes.");
        }
      },
    }),
    patchCategoryVariants: build.mutation<CategoryVariantsView, PatchCategoryVariantsArgs>({
      query: ({ categoryId, operation }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categoryVariants.detail(categoryId),
        method: "PATCH",
        body: operation,
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategoryVariantsView>) =>
        unwrapData(response),
      invalidatesTags: ["CategoryVariant"],
      async onQueryStarted({ operation }, { queryFulfilled }) {
        const { success, errorFallback } = PATCH_MESSAGES[operation.op];
        try {
          await queryFulfilled;
          notifyApiSuccess(success);
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, errorFallback);
        }
      },
    }),
  }),
});

export const {
  useGetCategoryVariantsQuery,
  useReplaceCategoryVariantsMutation,
  usePatchCategoryVariantsMutation,
} = categoryVariantsApi;
