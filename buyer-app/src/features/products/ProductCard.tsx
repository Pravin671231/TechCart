import Image from "next/image";
import Link from "next/link";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatPrice } from "./money";
import type { PublicProductListItem } from "./types";

export function ProductCard({ product }: { product: PublicProductListItem }) {
  const isOutOfStock = product.availability === "out_of_stock";

  return (
    <Link href={`/products/${product.slug}`} className="block">
      <article className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 shadow-sm transition hover:shadow-md">
        <div className="relative flex aspect-square items-center justify-center bg-neutral-50 text-xs text-neutral-400">
          {product.primaryImage ? (
            // R2's public URL base is env-specific and unknown to buyer-app at build
            // time, so remote-domain optimization can't be configured — unoptimized
            // bypasses Next's loader/allowlist entirely.
            <Image
              src={product.primaryImage.url}
              alt={product.primaryImage.alt ?? product.name}
              fill
              unoptimized
              sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            "Primary image"
          )}
          {isOutOfStock && (
            <span className="absolute top-2 left-2 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-600 shadow-sm">
              Out of stock
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-3">
          <p className="text-sm text-neutral-700">{product.name}</p>
          <PriceDisplay
            price={formatPrice(product.sellingPrice)}
            mrp={formatPrice(product.mrp)}
            discount={product.discount}
            size="sm"
          />
        </div>
      </article>
    </Link>
  );
}
