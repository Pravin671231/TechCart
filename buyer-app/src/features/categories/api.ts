import { api } from "@/store/api";
import type { PublicCategory } from "./types";

export const categoriesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCategories: builder.query<PublicCategory[], void>({
      query: () => ({ url: "/api/categories" }),
      transformResponse: (response: unknown): PublicCategory[] => response as PublicCategory[],
      providesTags: ["Category"],
    }),
  }),
});

export const { useGetCategoriesQuery } = categoriesApi;
