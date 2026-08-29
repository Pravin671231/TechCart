import { api } from "@/store/api";
import type { PublicCategory } from "./types";

export const categoriesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCategories: builder.query<PublicCategory[], void>({
      query: () => ({ url: "/api/categories" }),
      transformResponse: (response: unknown): PublicCategory[] => response as PublicCategory[],
      providesTags: ["Category"],
    }),
    // Issue #322 — header search-bar suggestions. `q` is required by the
    // backend (`GET /api/categories/search`); the caller slices to 5.
    searchCategories: builder.query<PublicCategory[], string>({
      query: (q) => ({ url: "/api/categories/search", params: { q } }),
      transformResponse: (response: unknown): PublicCategory[] => response as PublicCategory[],
      providesTags: ["Category"],
    }),
  }),
});

export const { useGetCategoriesQuery, useSearchCategoriesQuery } = categoriesApi;
