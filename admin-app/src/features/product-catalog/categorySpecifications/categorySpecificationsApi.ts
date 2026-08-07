import { api } from "@/app/api/baseApi";
import { unwrapData } from "@/app/api/apiResponse";
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

export const categorySpecificationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCategorySpecifications: build.query<CategorySpecificationsView, string>({
      query: (categoryId) => ({ url: PRODUCT_CATALOG_ENDPOINTS.categorySpecifications.detail(categoryId) }),
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
    }),
  }),
});

export const {
  useGetCategorySpecificationsQuery,
  useReplaceCategorySpecificationsMutation,
  usePatchCategorySpecificationsMutation,
} = categorySpecificationsApi;
