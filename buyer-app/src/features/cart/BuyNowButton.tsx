"use client";

import type { ProductAvailability } from "@/features/products/types";
import { SIZE_CLASSES, useAddToCart, type CartButtonSize } from "./useAddToCart";

// "Buy Now" — a single-item express path stacked above `AddToCartButton` on the
// category product card. There is no per-item checkout endpoint, so this adds
// the variant to the cart and then navigates to `/checkout` (or straight there
// if the cart already holds it). An unauthenticated click routes to sign-in
// with no mutation, exactly like `AddToCartButton` (FR-CART-020).
export function BuyNowButton({
  variantId,
  availability,
  size = "md",
  className = "",
}: {
  variantId: string | undefined;
  availability?: ProductAvailability;
  size?: CartButtonSize;
  className?: string;
}) {
  const { session, inCart, isAdding, insufficientStockMessage, goToCheckout, addItem } =
    useAddToCart(variantId);

  const base = `inline-flex items-center justify-center rounded-md font-medium transition ${SIZE_CLASSES[size]} ${className}`;

  if (!variantId) {
    return (
      <button type="button" disabled className={`${base} bg-neutral-100 text-neutral-400`}>
        Unavailable
      </button>
    );
  }

  if (availability === "out_of_stock") {
    return (
      <button type="button" disabled className={`${base} bg-neutral-100 text-neutral-400`}>
        Out of stock
      </button>
    );
  }

  const handleClick = () => {
    // Already in the cart — skip the add, go straight to checkout. Otherwise
    // `addItem` handles the signed-out redirect and the add, then checkout on
    // success (INSUFFICIENT_STOCK surfaces inline below without navigating).
    if (session && inCart) {
      goToCheckout();
      return;
    }
    addItem({ onSuccess: goToCheckout });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isAdding}
        className={`${base} bg-gradient-primary text-white hover:brightness-95 hover:shadow-md disabled:bg-none disabled:bg-neutral-300`}
      >
        Buy Now
      </button>
      {insufficientStockMessage && (
        <p role="alert" className="mt-1 text-xs text-accent-700">
          {insufficientStockMessage}
        </p>
      )}
    </>
  );
}
