import { api } from "@/store/api";
import type { CheckoutResponse } from "./types";

export const checkoutApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createOrder: builder.mutation<CheckoutResponse, { addressId: string }>({
      query: (body) => ({ url: "/api/orders", method: "POST", body }),
      // Checkout clears the ordered lines server-side (any dropped/
      // unavailable lines stay in the cart) — the cache must reflect that,
      // and the new order needs to show up in a later order-history fetch.
      invalidatesTags: ["Cart", "Order"],
    }),
  }),
});

export const { useCreateOrderMutation } = checkoutApi;
