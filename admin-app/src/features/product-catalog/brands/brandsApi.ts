import { api } from "@/app/api/baseApi";
import { unwrapData } from "@/app/api/apiResponse";
import type { ApiSuccessEnvelope } from "@/app/api/api.types";
import { PRODUCT_CATALOG_ENDPOINTS } from "../endpoints";
import type { Brand, BrandListItem, CreateBrandInput, UpdateBrandInput } from "./types";

export interface ListBrandsParams {
  search?: string;
}

export interface UpdateBrandArgs {
  id: string;
  patch: UpdateBrandInput;
}

export interface UpdateBrandStatusArgs {
  id: string;
  status: boolean;
}

export const brandsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getBrands: build.query<BrandListItem[], ListBrandsParams | void>({
      query: (params) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.brands.list,
        params: params?.search ? { search: params.search } : undefined,
      }),
      transformResponse: (response: ApiSuccessEnvelope<BrandListItem[]>) => unwrapData(response),
      providesTags: ["Brand"],
    }),
    createBrand: build.mutation<Brand, CreateBrandInput>({
      query: (body) => ({ url: PRODUCT_CATALOG_ENDPOINTS.brands.list, method: "POST", body }),
      transformResponse: (response: ApiSuccessEnvelope<Brand>) => unwrapData(response),
      invalidatesTags: ["Brand"],
    }),
    updateBrand: build.mutation<Brand, UpdateBrandArgs>({
      query: ({ id, patch }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.brands.detail(id),
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (response: ApiSuccessEnvelope<Brand>) => unwrapData(response),
      invalidatesTags: ["Brand"],
    }),
    updateBrandStatus: build.mutation<Brand, UpdateBrandStatusArgs>({
      query: ({ id, status }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.brands.status(id),
        method: "PATCH",
        body: { status },
      }),
      transformResponse: (response: ApiSuccessEnvelope<Brand>) => unwrapData(response),
      invalidatesTags: ["Brand"],
    }),
    deleteBrand: build.mutation<null, string>({
      query: (id) => ({ url: PRODUCT_CATALOG_ENDPOINTS.brands.detail(id), method: "DELETE" }),
      transformResponse: (response: ApiSuccessEnvelope<null>) => unwrapData(response),
      invalidatesTags: ["Brand"],
    }),
  }),
});

export const {
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useUpdateBrandStatusMutation,
  useDeleteBrandMutation,
} = brandsApi;
