import { api } from "@/app/api/baseApi";
import { unwrapData } from "@/app/api/apiResponse";
import { notifyApiError, notifyApiSuccess } from "@/app/api/apiToast";
import type { ApiSuccessEnvelope } from "@/app/api/api.types";
import { PRODUCT_CATALOG_ENDPOINTS } from "../endpoints";
import type { CategorySpecificationsView, SpecPatchOperation, SpecificationGroup } from "./types";

export interface ReplaceCategorySpecificationsArgs {
  categoryId: string;
  specificationGroups: SpecificationGroup[];
}

export interface PatchCategorySpecificationsArgs {
  categoryId: string;
  operation: SpecPatchOperation;
}

const PATCH_MESSAGES: Record<SpecPatchOperation["op"], { success: string; errorFallback: string }> =
  {
    renameGroup: { success: "Group renamed.", errorFallback: "Unable to rename the group." },
    deleteGroup: { success: "Group deleted.", errorFallback: "Unable to delete the group." },
    updateField: { success: "Field updated.", errorFallback: "Unable to update the field." },
    deleteField: { success: "Field deleted.", errorFallback: "Unable to delete the field." },
  };

export const categorySpecificationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCategorySpecifications: build.query<CategorySpecificationsView, string>({
      query: (categoryId) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categorySpecifications.detail(categoryId),
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategorySpecificationsView>) =>
        unwrapData(response),
      providesTags: ["CategorySpecification"],
    }),
    replaceCategorySpecifications: build.mutation<
      CategorySpecificationsView,
      ReplaceCategorySpecificationsArgs
    >({
      query: ({ categoryId, specificationGroups }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categorySpecifications.detail(categoryId),
        method: "PUT",
        body: { specificationGroups },
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategorySpecificationsView>) =>
        unwrapData(response),
      invalidatesTags: ["CategorySpecification"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Specification schema saved.");
        } catch (err) {
          notifyApiError(
            (err as { error: unknown }).error,
            "Unable to save the specification schema.",
          );
        }
      },
    }),
    patchCategorySpecifications: build.mutation<
      CategorySpecificationsView,
      PatchCategorySpecificationsArgs
    >({
      query: ({ categoryId, operation }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.categorySpecifications.detail(categoryId),
        method: "PATCH",
        body: operation,
      }),
      transformResponse: (response: ApiSuccessEnvelope<CategorySpecificationsView>) =>
        unwrapData(response),
      invalidatesTags: ["CategorySpecification"],
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
  useGetCategorySpecificationsQuery,
  useReplaceCategorySpecificationsMutation,
  usePatchCategorySpecificationsMutation,
} = categorySpecificationsApi;
