"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import type { ProductAvailability } from "@/features/products/types";
import type { NormalizedApiError } from "@/store/api";
import { useAddCartItemMutation, useGetCartQuery } from "./api";

const SIZE_CLASSES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

// The one add-to-cart control, shared by product cards (home/search/category)
// and the product detail page. Routes entirely on session state — an
// unauthenticated click never mutates the cart, even transiently
// (FR-CART-020). For a signed-in buyer whose cart already holds this variant
// it reads "Go to Cart" instead (FR-CART-021), derived from the cached
// getCart result — no per-card request.
export function AddToCartButton({
  variantId,
  availability,
  size = "md",
  className = "",
}: {
  variantId: string | undefined;
  // Issue #192/M10.4 (FR-INV-007) — a card passes its list item's own
  // best-across-active-variants availability; the PDP passes the currently
  // selected variant's. Never shown as a raw stock number.
  availability?: ProductAvailability;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useGetSessionQuery();
  const { data: cart } = useGetCartQuery(undefined, { skip: !session });
  const [addCartItem, { isLoading }] = useAddCartItemMutation();
  const [insufficientStockMessage, setInsufficientStockMessage] = useState<string | null>(null);

  const base = `inline-flex items-center justify-center rounded-md font-medium transition ${SIZE_CLASSES[size]} ${className}`;

  if (!variantId) {
    return (
      <button type="button" disabled className={`${base} bg-neutral-100 text-neutral-400`}>
        Unavailable
      </button>
    );
  }

  // FR-INV-007 — replaces the add-to-cart control entirely, never a raw
  // stock number.
  if (availability === "out_of_stock") {
    return (
      <button type="button" disabled className={`${base} bg-neutral-100 text-neutral-400`}>
        Out of stock
      </button>
    );
  }

  const inCart = !!cart?.items.some((line) => line.variant.id === variantId);

  if (session && inCart) {
    return (
      <button
        type="button"
        onClick={() => router.push("/cart")}
        className={`${base} border border-primary-600 bg-white text-primary-700 hover:bg-primary-50`}
      >
        Go to Cart
      </button>
    );
  }

  const handleClick = () => {
    if (!session) {
      router.push(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    setInsufficientStockMessage(null);
    addCartItem({ variantId })
      .unwrap()
      .catch((err: NormalizedApiError) => {
        // Issue #190/M10.2 — every other rejection is already rolled back
        // via the optimistic getCart cache patch with no inline copy; this
        // is the one case worth naming, since it's not a transient failure.
        if (err?.code === "INSUFFICIENT_STOCK") {
          setInsufficientStockMessage(err.message);
        }
      });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={`${base} bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60`}
      >
        Add to Cart
      </button>
      {insufficientStockMessage && (
        <p role="alert" className="mt-1 text-xs text-accent-700">
          {insufficientStockMessage}
        </p>
      )}
    </>
  );
}
