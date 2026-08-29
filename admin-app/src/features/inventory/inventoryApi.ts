import { api } from "@/app/api/baseApi";
import { unwrapData, unwrapList } from "@/app/api/apiResponse";
import { notifyApiError, notifyApiSuccess } from "@/app/api/apiToast";
import type { ApiSuccessEnvelope, ApiSuccessListEnvelope, Pagination } from "@/app/api/api.types";
import { INVENTORY_ENDPOINTS } from "./endpoints";
import type { CreateWarehouseInput, InventoryItem, Warehouse } from "./types";

export interface ListInventoryParams {
  warehouseId?: string;
  search?: string;
  page?: number;
}

export interface UpdateInventoryStockArgs {
  id: string;
  stock: number;
}

export const inventoryApi = api.injectEndpoints({
  endpoints: (build) => ({
    getWarehouses: build.query<Warehouse[], void>({
      query: () => ({ url: INVENTORY_ENDPOINTS.warehouses }),
      transformResponse: (response: ApiSuccessEnvelope<Warehouse[]>) => unwrapData(response),
      providesTags: ["Warehouse"],
    }),
    createWarehouse: build.mutation<Warehouse, CreateWarehouseInput>({
      query: (body) => ({ url: INVENTORY_ENDPOINTS.warehouses, method: "POST", body }),
      transformResponse: (response: ApiSuccessEnvelope<Warehouse>) => unwrapData(response),
      invalidatesTags: ["Warehouse"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Warehouse created.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to create warehouse.");
        }
      },
    }),
    getInventory: build.query<
      { items: InventoryItem[]; pagination: Pagination },
      ListInventoryParams | void
    >({
      query: (params) => ({
        url: INVENTORY_ENDPOINTS.inventory,
        params: {
          warehouseId: params?.warehouseId || undefined,
          search: params?.search || undefined,
          page: params?.page,
        },
      }),
      transformResponse: (response: ApiSuccessListEnvelope<InventoryItem>) => unwrapList(response),
      providesTags: ["Inventory"],
    }),
    updateInventoryStock: build.mutation<InventoryItem, UpdateInventoryStockArgs>({
      query: ({ id, stock }) => ({
        url: INVENTORY_ENDPOINTS.inventoryDetail(id),
        method: "PATCH",
        body: { stock },
      }),
      transformResponse: (response: ApiSuccessEnvelope<InventoryItem>) => unwrapData(response),
      invalidatesTags: ["Inventory"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Stock updated.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to update stock.");
        }
      },
    }),
  }),
});

export const {
  useGetWarehousesQuery,
  useCreateWarehouseMutation,
  useGetInventoryQuery,
  useUpdateInventoryStockMutation,
} = inventoryApi;
