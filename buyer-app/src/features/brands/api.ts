import { api } from "@/store/api";
import type { PublicBrand } from "./types";

export const brandsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBrands: builder.query<PublicBrand[], void>({
      query: () => ({ url: "/api/brands" }),
      transformResponse: (response: unknown): PublicBrand[] => response as PublicBrand[],
    }),
  }),
});

export const { useGetBrandsQuery } = brandsApi;
