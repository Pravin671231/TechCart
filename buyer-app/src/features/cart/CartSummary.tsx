"use client";

import { useRouter } from "next/navigation";
import { formatPrice } from "@/features/products/money";
import type { Cart } from "./types";

export function CartSummary({ cart }: { cart: Cart }) {
  const router = useRouter();
  const availableCount = cart.items.filter((line) => !line.unavailable).length;
  const unavailableCount = cart.items.length - availableCount;

  return (
    <aside className="h-fit rounded-lg border border-neutral-200 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
        Order summary
      </h2>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between text-neutral-600">
          <dt>Items ({cart.itemCount})</dt>
          <dd>{formatPrice(cart.subtotal)}</dd>
        </div>
        {unavailableCount > 0 && (
          <div className="flex justify-between text-xs text-accent-700">
            <dt>{unavailableCount} unavailable item(s)</dt>
            <dd>excluded</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex justify-between border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-900">
        <span>Subtotal</span>
        <span>{formatPrice(cart.subtotal)}</span>
      </div>

      <button
        type="button"
        disabled={availableCount === 0}
        onClick={() => router.push("/checkout")}
        className="mt-5 w-full rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        Proceed to checkout
      </button>
      {availableCount === 0 && (
        <p className="mt-2 text-center text-xs text-neutral-500">
          Add an available item to check out.
        </p>
      )}
    </aside>
  );
}
