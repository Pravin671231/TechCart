import { api } from "@/store/api";
import type { CheckoutResponse, OrderResponse } from "./types";

// M6/#169 — the Razorpay checkout-widget fields returned by
// POST /api/orders/:id/payment (never the account's key_secret).
export type InitiatePaymentResult = {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

export type VerifyPaymentInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export const checkoutApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createOrder: builder.mutation<CheckoutResponse, { addressId: string }>({
      query: (body) => ({ url: "/api/orders", method: "POST", body }),
      // Checkout clears the ordered lines server-side (any dropped/
      // unavailable lines stay in the cart) — the cache must reflect that,
      // and the new order needs to show up in a later order-history fetch.
      invalidatesTags: ["Cart", "Order"],
    }),

    // FR-PAY-001-004 — mints (or, idempotently, reuses) a Razorpay order for
    // the given TechCart order, to open the Checkout widget with.
    initiatePayment: builder.mutation<InitiatePaymentResult, { orderId: string }>({
      query: ({ orderId }) => ({ url: `/api/orders/${orderId}/payment`, method: "POST" }),
    }),

    // FR-PAY-005-011 — the widget's client-side success callback, verified
    // server-side. Invalidates "Order" so the order detail view (and this
    // screen's own cached order, via a refetch) reflects the new "paid"
    // status once this resolves.
    verifyPayment: builder.mutation<OrderResponse, { orderId: string } & VerifyPaymentInput>({
      query: ({ orderId, ...body }) => ({
        url: `/api/orders/${orderId}/payment/verify`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Order"],
    }),
  }),
});

export const { useCreateOrderMutation, useInitiatePaymentMutation, useVerifyPaymentMutation } =
  checkoutApi;
