import { api } from "@/store/api";
import type { GetOrdersResult, OrderResponse } from "./types";

export const ordersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<GetOrdersResult, { page: number }>({
      query: ({ page }) => ({ url: "/api/orders", params: { page } }),
      transformResponse: (response: unknown, meta): GetOrdersResult => {
        if (!meta?.pagination) {
          throw new Error("Expected pagination metadata on an order list response.");
        }
        return { items: response as OrderResponse[], pagination: meta.pagination };
      },
      providesTags: ["Order"],
    }),

    getOrder: builder.query<OrderResponse, string>({
      query: (id) => ({ url: `/api/orders/${id}` }),
      transformResponse: (response: unknown): OrderResponse => response as OrderResponse,
      providesTags: ["Order"],
    }),

    cancelOrder: builder.mutation<OrderResponse, { id: string }>({
      query: ({ id }) => ({ url: `/api/orders/${id}/cancel`, method: "POST" }),
      invalidatesTags: ["Order"],
    }),
  }),
});

export const { useGetOrdersQuery, useGetOrderQuery, useCancelOrderMutation } = ordersApi;
