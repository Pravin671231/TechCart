import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/features/products/money";
import type { OrderItemView } from "./types";

// Read-only counterpart to cart/CartLineRow.tsx's row layout (image left,
// details middle, price right) — an order's items aren't editable, so no
// quantity stepper/remove control.
export function OrderItemRow({ item }: { item: OrderItemView }) {
  const { product, variant, quantity, lineTotal } = item;

  return (
    <div className="flex gap-4 rounded-lg border border-neutral-200 p-4">
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-50 text-[10px] text-neutral-400">
        {variant.image ? (
          <Image
            src={variant.image.url}
            alt={variant.image.alt ?? product.name}
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
          href={`/products/${product.slug}`}
          className="text-sm font-medium text-neutral-900 hover:text-primary-600"
        >
          {product.name}
        </Link>
        {variant.attributes.length > 0 && (
          <p className="text-xs text-neutral-500">
            {variant.attributes.map((a) => `${a.name}: ${a.value}`).join(" · ")}
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-500">× {quantity}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-neutral-900">{formatPrice(lineTotal)}</p>
      </div>
    </div>
  );
}
