import { api } from "@/app/api/baseApi";
import { unwrapData, type ApiSuccessEnvelope } from "@/app/api/responseEnvelope";
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
      query: (categoryId) => ({ url: `/categories/${categoryId}/specifications` }),
      transformResponse: (response: ApiSuccessEnvelope<CategorySpecificationsView>) =>
        unwrapData(response),
      providesTags: ["CategorySpecification"],
    }),
    replaceCategorySpecifications: build.mutation<
      CategorySpecificationsView,
      ReplaceCategorySpecificationsArgs
    >({
      query: ({ categoryId, specificationGroups }) => ({
        url: `/categories/${categoryId}/specifications`,
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
        url: `/categories/${categoryId}/specifications`,
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
