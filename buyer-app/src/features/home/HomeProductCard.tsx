import Image from "next/image";
import Link from "next/link";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatPrice } from "@/features/products/money";
import type { PublicProductListItem } from "@/features/products/types";

// Home-only product card. Unlike the shared features/products/ProductCard
// (still used by Search), this one carries no AddToCartButton — the whole card
// is a single link to the product detail page, the price gets more visual
// weight (size="md"), and hover gives a premium lift + shadow + brand-color
// title. Scoped to Home per Issue #345.
export function HomeProductCard({ product }: { product: PublicProductListItem }) {
  const isOutOfStock = product.availability === "out_of_stock";

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-2xl motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <Link href={`/products/${product.slug}`} className="flex flex-1 flex-col">
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
        <div className="flex flex-col gap-1.5 p-3">
          <p className="text-sm text-neutral-700 transition-colors group-hover:text-primary-700">
            {product.name}
          </p>
          <PriceDisplay
            price={formatPrice(product.sellingPrice)}
            mrp={formatPrice(product.mrp)}
            discount={product.discount}
            size="md"
          />
        </div>
      </Link>
    </article>
  );
}
