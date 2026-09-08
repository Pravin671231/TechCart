"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import type { NormalizedApiError } from "@/store/api";
import { useAddCartItemMutation, useGetCartQuery } from "./api";

export const SIZE_CLASSES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export type CartButtonSize = keyof typeof SIZE_CLASSES;

// The add-to-cart click behaviour shared by `AddToCartButton` and
// `BuyNowButton` (product cards + PDP). Routes entirely on session state — an
// unauthenticated `addItem` never mutates the cart (FR-CART-020) — and derives
// `inCart` from the cached `getCart` result (FR-CART-021) with no per-card
// request. `INSUFFICIENT_STOCK` (Issue #190/M10.2) is the one add rejection
// surfaced inline; every other rejection rolls back silently via the optimistic
// `getCart` patch in `cart/api.ts`.
export function useAddToCart(variantId: string | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useGetSessionQuery();
  const { data: cart } = useGetCartQuery(undefined, { skip: !session });
  const [addCartItem, { isLoading: isAdding }] = useAddCartItemMutation();
  const [insufficientStockMessage, setInsufficientStockMessage] = useState<string | null>(null);

  const inCart = !!cart?.items.some((line) => line.variant.id === variantId);

  const goToSignIn = () => router.push(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
  const goToCheckout = () => router.push("/checkout");
  const goToCart = () => router.push("/cart");

  const addItem = (opts?: { onSuccess?: () => void }) => {
    if (!session) {
      goToSignIn();
      return;
    }
    if (!variantId) return;
    setInsufficientStockMessage(null);
    addCartItem({ variantId })
      .unwrap()
      .then(
        () => opts?.onSuccess?.(),
        (err: NormalizedApiError) => {
          if (err?.code === "INSUFFICIENT_STOCK") {
            setInsufficientStockMessage(err.message);
          }
        },
      );
  };

  return {
    session,
    inCart,
    isAdding,
    insufficientStockMessage,
    goToSignIn,
    goToCheckout,
    goToCart,
    addItem,
  };
}
