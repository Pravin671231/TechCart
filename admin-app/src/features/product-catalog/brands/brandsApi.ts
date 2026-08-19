import { api } from "@/app/api/baseApi";
import { unwrapData, unwrapList } from "@/app/api/apiResponse";
import { notifyApiError, notifyApiSuccess } from "@/app/api/apiToast";
import type { ApiSuccessEnvelope, ApiSuccessListEnvelope, Pagination } from "@/app/api/api.types";
import { PRODUCT_CATALOG_ENDPOINTS } from "../endpoints";
import type { Brand, BrandListItem, CreateBrandInput, UpdateBrandInput } from "./types";

export interface ListBrandsParams {
  search?: string;
  page?: number;
  limit?: number;
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
    getBrands: build.query<
      { items: BrandListItem[]; pagination: Pagination },
      ListBrandsParams | void
    >({
      query: (params) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.brands.list,
        params: {
          search: params?.search || undefined,
          page: params?.page,
          limit: params?.limit,
        },
      }),
      transformResponse: (response: ApiSuccessListEnvelope<BrandListItem>) => unwrapList(response),
      providesTags: ["Brand"],
    }),
    createBrand: build.mutation<Brand, CreateBrandInput>({
      query: (body) => ({ url: PRODUCT_CATALOG_ENDPOINTS.brands.list, method: "POST", body }),
      transformResponse: (response: ApiSuccessEnvelope<Brand>) => unwrapData(response),
      invalidatesTags: ["Brand"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Brand created.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to create brand.");
        }
      },
    }),
    updateBrand: build.mutation<Brand, UpdateBrandArgs>({
      query: ({ id, patch }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.brands.detail(id),
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (response: ApiSuccessEnvelope<Brand>) => unwrapData(response),
      invalidatesTags: ["Brand"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Brand updated.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to update brand.");
        }
      },
    }),
    updateBrandStatus: build.mutation<Brand, UpdateBrandStatusArgs>({
      query: ({ id, status }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.brands.status(id),
        method: "PATCH",
        body: { status },
      }),
      transformResponse: (response: ApiSuccessEnvelope<Brand>) => unwrapData(response),
      invalidatesTags: ["Brand"],
      async onQueryStarted({ status }, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess(status ? "Brand activated." : "Brand deactivated.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to update brand status.");
        }
      },
    }),
    deleteBrand: build.mutation<null, string>({
      query: (id) => ({ url: PRODUCT_CATALOG_ENDPOINTS.brands.detail(id), method: "DELETE" }),
      transformResponse: (response: ApiSuccessEnvelope<null>) => unwrapData(response),
      invalidatesTags: ["Brand"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Brand deleted.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to delete brand.");
        }
      },
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
