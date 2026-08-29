"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/features/products/money";
import type { NormalizedApiError } from "@/store/api";
import { useRemoveCartItemMutation, useUpdateCartItemMutation } from "./api";
import type { CartLineItem } from "./types";

const MAX_QUANTITY = 10;

export function CartLineRow({ line }: { line: CartLineItem }) {
  const [updateItem, { isLoading: isUpdating }] = useUpdateCartItemMutation();
  const [removeItem, { isLoading: isRemoving }] = useRemoveCartItemMutation();
  const [insufficientStockMessage, setInsufficientStockMessage] = useState<string | null>(null);
  const busy = isUpdating || isRemoving;

  const { variant, quantity, lineTotal, unavailable } = line;

  const setQuantity = (next: number) => {
    if (next < 0 || next > MAX_QUANTITY || next === quantity) return;
    setInsufficientStockMessage(null);
    updateItem({ variantId: variant.id, quantity: next })
      .unwrap()
      .catch((err: NormalizedApiError) => {
        // Issue #190/M10.2 — every other rejection is rolled back via the
        // optimistic cache patch with no inline copy; INSUFFICIENT_STOCK is
        // the one worth naming, since a quantity increase can genuinely
        // outrun the warehouse it was allocated to.
        if (err?.code === "INSUFFICIENT_STOCK") {
          setInsufficientStockMessage(err.message);
        }
      });
  };

  return (
    <div
      className={`flex gap-4 rounded-lg border border-neutral-200 p-4 ${
        unavailable ? "opacity-60" : ""
      }`}
    >
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-50 text-[10px] text-neutral-400">
        {variant.primaryImage ? (
          <Image
            src={variant.primaryImage.url}
            alt={variant.primaryImage.alt ?? variant.product.name}
            fill
            unoptimized
            sizes="96px"
            className="object-cover"
          />
        ) : (
          "No image"
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <Link
          href={`/products/${variant.product.slug}`}
          className="text-sm font-medium text-neutral-900 hover:text-primary-600"
        >
          {variant.product.name}
        </Link>
        {variant.attributes.length > 0 && (
          <p className="text-xs text-neutral-500">
            {variant.attributes.map((a) => `${a.name}: ${a.value}`).join(" · ")}
          </p>
        )}

        {unavailable && (
          <p className="text-xs font-medium text-accent-700">
            No longer available — excluded from your total
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center rounded-md border border-neutral-300">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={busy || unavailable || quantity <= 1}
              onClick={() => setQuantity(quantity - 1)}
              className="px-2 py-1 text-sm text-neutral-600 disabled:text-neutral-300"
            >
              −
            </button>
            <span className="min-w-6 px-1 text-center text-sm">{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={busy || unavailable || quantity >= MAX_QUANTITY}
              onClick={() => setQuantity(quantity + 1)}
              className="px-2 py-1 text-sm text-neutral-600 disabled:text-neutral-300"
            >
              +
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              removeItem({ variantId: variant.id }).catch(() => {
                /* rolled back via cache */
              })
            }
            className="text-xs font-medium text-neutral-500 hover:text-accent-700 disabled:opacity-50"
          >
            Remove
          </button>
        </div>

        {insufficientStockMessage && (
          <p role="alert" className="text-xs text-accent-700">
            {insufficientStockMessage}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-semibold ${unavailable ? "text-neutral-400 line-through" : "text-neutral-900"}`}
        >
          {formatPrice(unavailable ? line.sellingPrice * quantity : lineTotal)}
        </p>
      </div>
    </div>
  );
}
