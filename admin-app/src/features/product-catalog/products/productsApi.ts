import { api } from "@/app/api/baseApi";
import { unwrapData, unwrapList } from "@/app/api/apiResponse";
import { notifyApiError, notifyApiSuccess } from "@/app/api/apiToast";
import type { ApiSuccessEnvelope, ApiSuccessListEnvelope, Pagination } from "@/app/api/api.types";
import { PRODUCT_CATALOG_ENDPOINTS } from "../endpoints";
import type {
  AddVariantInput,
  CreateProductInput,
  Product,
  ProductSort,
  ProductStatus,
  UpdateProductInput,
  UpdateVariantInput,
} from "./types";

export interface ListProductsParams {
  page?: number;
  limit?: number;
  sort?: ProductSort;
  search?: string;
  status?: ProductStatus;
}

export interface UpdateProductStatusArgs {
  id: string;
  status: ProductStatus;
}

export interface UpdateProductArgs {
  id: string;
  patch: UpdateProductInput;
}

export interface AddVariantArgs {
  productId: string;
  body: AddVariantInput;
}

export interface UpdateVariantArgs {
  productId: string;
  variantId: string;
  patch: UpdateVariantInput;
}

const PRODUCT_STATUS_MESSAGE: Record<ProductStatus, string> = {
  draft: "Product set to draft.",
  published: "Product published.",
  archived: "Product archived.",
};

// Splits the UI's combined ProductSort ("name" | "-name" | ...) into the
// two separate params the backend expects (Issue #104) — kept as a
// translation at the request-building boundary so ProductList.tsx's
// SortableHeader wiring didn't need to change shape for this issue.
function toSortByOrderBy(sort: ProductSort | undefined): {
  sortBy?: "createdAt" | "name";
  orderBy?: "asc" | "desc";
} {
  if (!sort) return {};
  const isDesc = sort.startsWith("-");
  return { sortBy: (isDesc ? sort.slice(1) : sort) as "createdAt" | "name", orderBy: isDesc ? "desc" : "asc" };
}

export const productsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProducts: build.query<
      { items: Product[]; pagination: Pagination },
      ListProductsParams | void
    >({
      query: (params) => {
        const { sortBy, orderBy } = toSortByOrderBy(params?.sort);
        return {
          url: PRODUCT_CATALOG_ENDPOINTS.products.list,
          params: {
            page: params?.page,
            limit: params?.limit,
            sortBy,
            orderBy,
            search: params?.search || undefined,
            status: params?.status,
          },
        };
      },
      transformResponse: (response: ApiSuccessListEnvelope<Product>) => unwrapList(response),
      providesTags: ["Product"],
    }),
    getProduct: build.query<Product, string>({
      query: (id) => ({ url: PRODUCT_CATALOG_ENDPOINTS.products.detail(id) }),
      transformResponse: (response: ApiSuccessEnvelope<Product>) => unwrapData(response),
      providesTags: ["Product"],
    }),
    updateProductStatus: build.mutation<Product, UpdateProductStatusArgs>({
      query: ({ id, status }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.products.status(id),
        method: "PATCH",
        body: { status },
      }),
      transformResponse: (response: ApiSuccessEnvelope<Product>) => unwrapData(response),
      invalidatesTags: ["Product"],
      async onQueryStarted({ status }, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess(PRODUCT_STATUS_MESSAGE[status]);
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to update product status.");
        }
      },
    }),
    createProduct: build.mutation<Product, CreateProductInput>({
      query: (body) => ({ url: PRODUCT_CATALOG_ENDPOINTS.products.list, method: "POST", body }),
      transformResponse: (response: ApiSuccessEnvelope<Product>) => unwrapData(response),
      invalidatesTags: ["Product"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Product created.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to create product.");
        }
      },
    }),
    updateProduct: build.mutation<Product, UpdateProductArgs>({
      query: ({ id, patch }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.products.detail(id),
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (response: ApiSuccessEnvelope<Product>) => unwrapData(response),
      invalidatesTags: ["Product"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Product updated.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to update product.");
        }
      },
    }),
    addVariant: build.mutation<Product, AddVariantArgs>({
      query: ({ productId, body }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.products.variants(productId),
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiSuccessEnvelope<Product>) => unwrapData(response),
      invalidatesTags: ["Product"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Variant added.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to add variant.");
        }
      },
    }),
    updateVariant: build.mutation<Product, UpdateVariantArgs>({
      query: ({ productId, variantId, patch }) => ({
        url: PRODUCT_CATALOG_ENDPOINTS.products.variant(productId, variantId),
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (response: ApiSuccessEnvelope<Product>) => unwrapData(response),
      invalidatesTags: ["Product"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Variant updated.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to update variant.");
        }
      },
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useUpdateProductStatusMutation,
  useCreateProductMutation,
  useUpdateProductMutation,
  useAddVariantMutation,
  useUpdateVariantMutation,
} = productsApi;
