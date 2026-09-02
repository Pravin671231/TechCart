import { api } from "@/app/api/baseApi";
import { unwrapData, unwrapList } from "@/app/api/apiResponse";
import { notifyApiError, notifyApiSuccess } from "@/app/api/apiToast";
import type { ApiSuccessEnvelope, ApiSuccessListEnvelope, Pagination } from "@/app/api/api.types";
import { ORDERS_ENDPOINTS } from "./endpoints";
import type { AdminOrder, OrderSort, OrderStatus } from "./types";

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  sort?: OrderSort;
  search?: string;
  status?: OrderStatus;
}

export interface UpdateOrderStatusArgs {
  id: string;
  status: OrderStatus;
}

export interface CancelOrderArgs {
  id: string;
  reason: string;
}

export interface RefundOrderArgs {
  id: string;
  /** Integer paise, matching backend's refundSchema; omitted = full remaining balance. */
  amount?: number;
  reason: string;
}

// Splits the UI's combined OrderSort ("-createdAt" | ...) into the two
// separate params the backend expects — same translation-at-the-boundary
// shape as products/productsApi.ts's own toSortByOrderBy.
function toSortByOrderBy(sort: OrderSort | undefined): {
  sortBy?: "createdAt" | "totalAmount";
  orderBy?: "asc" | "desc";
} {
  if (!sort) return {};
  const isDesc = sort.startsWith("-");
  return {
    sortBy: (isDesc ? sort.slice(1) : sort) as "createdAt" | "totalAmount",
    orderBy: isDesc ? "desc" : "asc",
  };
}

export const ordersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOrders: build.query<
      { items: AdminOrder[]; pagination: Pagination },
      ListOrdersParams | void
    >({
      query: (params) => {
        const { sortBy, orderBy } = toSortByOrderBy(params?.sort);
        return {
          url: ORDERS_ENDPOINTS.list,
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
      transformResponse: (response: ApiSuccessListEnvelope<AdminOrder>) => unwrapList(response),
      providesTags: ["Order"],
    }),
    getOrder: build.query<AdminOrder, string>({
      query: (id) => ({ url: ORDERS_ENDPOINTS.detail(id) }),
      transformResponse: (response: ApiSuccessEnvelope<AdminOrder>) => unwrapData(response),
      providesTags: ["Order"],
    }),
    updateOrderStatus: build.mutation<AdminOrder, UpdateOrderStatusArgs>({
      query: ({ id, status }) => ({
        url: ORDERS_ENDPOINTS.status(id),
        method: "PATCH",
        body: { status },
      }),
      transformResponse: (response: ApiSuccessEnvelope<AdminOrder>) => unwrapData(response),
      invalidatesTags: ["Order"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Order status updated.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to update order status.");
        }
      },
    }),
    cancelOrder: build.mutation<AdminOrder, CancelOrderArgs>({
      query: ({ id, reason }) => ({
        url: ORDERS_ENDPOINTS.cancel(id),
        method: "POST",
        body: { reason },
      }),
      transformResponse: (response: ApiSuccessEnvelope<AdminOrder>) => unwrapData(response),
      invalidatesTags: ["Order"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Order cancelled.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to cancel order.");
        }
      },
    }),
    refundOrder: build.mutation<AdminOrder, RefundOrderArgs>({
      query: ({ id, amount, reason }) => ({
        url: ORDERS_ENDPOINTS.refund(id),
        method: "POST",
        body: { amount, reason },
      }),
      transformResponse: (response: ApiSuccessEnvelope<AdminOrder>) => unwrapData(response),
      invalidatesTags: ["Order"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Refund processed.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to process refund.");
        }
      },
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderQuery,
  useUpdateOrderStatusMutation,
  useCancelOrderMutation,
  useRefundOrderMutation,
} = ordersApi;
