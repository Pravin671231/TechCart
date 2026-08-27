"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/features/products/money";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { useGetCartQuery } from "@/features/cart/api";

function CartIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export function CartIndicator() {
  const { data: session } = useGetSessionQuery();
  const { data: cart } = useGetCartQuery(undefined, { skip: !session });

  // Unauthenticated: the icon routes to sign-in, no badge (FR-CART-019, SRS §6).
  if (!session) {
    return (
      <Link
        href="/sign-in?redirect=/cart"
        aria-label="Cart"
        className="text-gray-700 hover:text-gray-900"
      >
        <CartIcon />
      </Link>
    );
  }

  const itemCount = cart?.itemCount ?? 0;

  return (
    <div className="group relative">
      <Link
        href="/cart"
        aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
        className="relative flex text-gray-700 hover:text-gray-900"
      >
        <CartIcon />
        {itemCount > 0 && (
          <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
            {itemCount}
          </span>
        )}
      </Link>

      {/* Mini-cart preview — opens on hover/focus of the group. */}
      <div className="invisible absolute right-0 z-30 mt-2 w-80 rounded-lg border border-neutral-200 bg-white p-3 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        {!cart || cart.items.length === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-neutral-500">Your cart is empty.</p>
        ) : (
          <>
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {cart.items.map((line) => (
                <li key={line.variant.id} className="flex gap-2">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-neutral-50">
                    {line.variant.primaryImage && (
                      <Image
                        src={line.variant.primaryImage.url}
                        alt={line.variant.primaryImage.alt ?? line.variant.product.name}
                        fill
                        unoptimized
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col text-xs">
                    <span className="line-clamp-1 text-neutral-800">
                      {line.variant.product.name}
                    </span>
                    <span className="text-neutral-500">
                      ×{line.quantity}
                      {line.unavailable ? " · unavailable" : ""}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-neutral-700">
                    {formatPrice(line.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-2 text-sm">
              <span className="text-neutral-500">Subtotal</span>
              <span className="font-semibold text-neutral-900">{formatPrice(cart.subtotal)}</span>
            </div>
          </>
        )}
        <Link
          href="/cart"
          className="mt-3 block rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-primary-700"
        >
          View cart
        </Link>
      </div>
    </div>
  );
}
