"use client";

import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { AddToCartButton } from "@/features/cart/AddToCartButton";
import { BuyNowButton } from "@/features/cart/BuyNowButton";
import { formatPrice } from "@/features/products/money";
import type { ProductAvailability } from "@/features/products/types";
import { AvailabilityBadge } from "./AvailabilityBadge";

// The purchase panel — availability, the prominent discounted price, and the
// Buy Now (primary) / Add to Cart (secondary) CTAs. Both buttons are reused
// verbatim from src/features/cart/; they own the signed-out redirect, the
// "Go to Cart" state, the out-of-stock disabled state and the
// INSUFFICIENT_STOCK inline message. Only w-full plus variant-prefixed
// (active:/focus-visible:) utilities are layered on via className so nothing
// collides with the buttons' own size/colour classes.
export function ProductBuyBox({
  price,
  mrp,
  discount,
  availability,
  variantId,
}: {
  price: number;
  mrp: number;
  discount: number;
  availability?: ProductAvailability;
  variantId: string | undefined;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      {availability && (
        <div className="mb-3">
          <AvailabilityBadge availability={availability} />
        </div>
      )}

      <div className="mb-4">
        <PriceDisplay
          price={formatPrice(price)}
          mrp={formatPrice(mrp)}
          discount={discount}
          size="lg"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <BuyNowButton
          variantId={variantId}
          availability={availability}
          size="md"
          className="flex-1 active:brightness-90 focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 focus-visible:outline-none"
        />
        <AddToCartButton
          variantId={variantId}
          availability={availability}
          size="md"
          className="flex-1 active:brightness-95 focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 focus-visible:outline-none"
        />
      </div>
    </section>
  );
}
