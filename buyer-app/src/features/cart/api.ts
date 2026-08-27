import { api } from "@/store/api";
import type { Cart } from "./types";

// Recompute the two summary numbers after an optimistic mutation of `items`.
// itemCount counts every line; subtotal excludes unavailable ones (their
// lineTotal is already 0). Mirrors backend cart.service.ts's buildCartResponse.
function recalc(cart: Cart): void {
  cart.itemCount = cart.items.reduce((sum, line) => sum + line.quantity, 0);
  cart.subtotal = cart.items.reduce((sum, line) => sum + line.lineTotal, 0);
}

// Every cart mutation returns the full, authoritative cart. The shared
// pattern in each onQueryStarted below: apply an optimistic patch to the
// `getCart` cache now, replace it with the server's response once it lands,
// roll back on error.
export const cartApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCart: builder.query<Cart, void>({
      query: () => ({ url: "/api/cart" }),
      transformResponse: (response: unknown): Cart => response as Cart,
      providesTags: ["Cart"],
    }),

    addCartItem: builder.mutation<Cart, { variantId: string; quantity?: number }>({
      query: ({ variantId, quantity = 1 }) => ({
        url: "/api/cart/items",
        method: "POST",
        body: { variantId, quantity },
      }),
      async onQueryStarted({ variantId, quantity = 1 }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          cartApi.util.updateQueryData("getCart", undefined, (draft) => {
            const existing = draft.items.find((line) => line.variant.id === variantId);
            if (existing) {
              existing.quantity += quantity;
              existing.lineTotal = existing.unavailable
                ? 0
                : existing.sellingPrice * existing.quantity;
            }
            // A brand-new line can't be constructed here (no price/variant
            // detail client-side) — the header badge still moves via itemCount,
            // and the full line arrives with the server response below.
            draft.itemCount += quantity;
            recalc(draft);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(cartApi.util.updateQueryData("getCart", undefined, () => data));
        } catch {
          patch.undo();
        }
      },
    }),

    updateCartItem: builder.mutation<Cart, { variantId: string; quantity: number }>({
      query: ({ variantId, quantity }) => ({
        url: `/api/cart/items/${variantId}`,
        method: "PATCH",
        body: { quantity },
      }),
      async onQueryStarted({ variantId, quantity }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          cartApi.util.updateQueryData("getCart", undefined, (draft) => {
            if (quantity === 0) {
              draft.items = draft.items.filter((line) => line.variant.id !== variantId);
            } else {
              const line = draft.items.find((l) => l.variant.id === variantId);
              if (line) {
                line.quantity = quantity;
                line.lineTotal = line.unavailable ? 0 : line.sellingPrice * quantity;
              }
            }
            recalc(draft);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(cartApi.util.updateQueryData("getCart", undefined, () => data));
        } catch {
          patch.undo();
        }
      },
    }),

    removeCartItem: builder.mutation<Cart, { variantId: string }>({
      query: ({ variantId }) => ({ url: `/api/cart/items/${variantId}`, method: "DELETE" }),
      async onQueryStarted({ variantId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          cartApi.util.updateQueryData("getCart", undefined, (draft) => {
            draft.items = draft.items.filter((line) => line.variant.id !== variantId);
            recalc(draft);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(cartApi.util.updateQueryData("getCart", undefined, () => data));
        } catch {
          patch.undo();
        }
      },
    }),

    clearCart: builder.mutation<Cart, void>({
      query: () => ({ url: "/api/cart", method: "DELETE" }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          cartApi.util.updateQueryData("getCart", undefined, (draft) => {
            draft.items = [];
            recalc(draft);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(cartApi.util.updateQueryData("getCart", undefined, () => data));
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const {
  useGetCartQuery,
  useAddCartItemMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
  useClearCartMutation,
} = cartApi;
