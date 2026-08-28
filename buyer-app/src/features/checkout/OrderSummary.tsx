import { formatPrice } from "@/features/products/money";
import type { Cart } from "@/features/cart/types";

// Checkout's own read-only summary of the cart's available lines — distinct
// from cart/CartSummary.tsx, which owns the "Proceed to checkout" CTA that
// brought the buyer here in the first place.
export function OrderSummary({ cart }: { cart: Cart }) {
  const availableLines = cart.items.filter((line) => !line.unavailable);

  return (
    <section className="h-fit rounded-lg border border-neutral-200 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
        Order summary
      </h2>

      <ul className="mt-4 flex flex-col gap-3 text-sm">
        {availableLines.map((line) => (
          <li key={line.variant.id} className="flex justify-between gap-3">
            <span className="text-neutral-700">
              {line.variant.product.name} × {line.quantity}
            </span>
            <span className="shrink-0 font-medium text-neutral-900">
              {formatPrice(line.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-between border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-900">
        <span>Total</span>
        <span>{formatPrice(cart.subtotal)}</span>
      </div>
    </section>
  );
}
