import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/features/cart/AddToCartButton";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatPrice } from "@/features/products/money";
import type { PublicProductListItem } from "@/features/products/types";

// The detailed card — image · title+specs · price · reserved gutter on desktop,
// and price-then-title-below (no specs) on mobile — is shown only when the
// product's category supplies filterable card specifications (phones / tablets /
// iPad / laptops in practice). Every other category keeps the plain row card
// unchanged at every breakpoint. The discriminator is data-driven, never a
// hardcoded category slug list.
export function CategoryProductCard({ product }: { product: PublicProductListItem }) {
  return product.cardSpecifications.length > 0 ? (
    <DetailedCategoryProductCard product={product} />
  ) : (
    <PlainCategoryProductCard product={product} />
  );
}

function PriceSection({ product }: { product: PublicProductListItem }) {
  return (
    <div className="flex flex-col items-stretch gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-right">
      <PriceDisplay
        price={formatPrice(product.sellingPrice)}
        mrp={formatPrice(product.mrp)}
        discount={product.discount}
        size="md"
        stacked
      />
      <AddToCartButton
        variantId={product.defaultVariantId}
        availability={product.availability}
        size="sm"
        className="mt-1 w-full"
      />
    </div>
  );
}

function PlainCategoryProductCard({ product }: { product: PublicProductListItem }) {
  const isOutOfStock = product.availability === "out_of_stock";

  return (
    <article className="flex gap-6 border-b border-neutral-200 py-6 first:pt-0 last:border-b-0">
      <Link href={`/products/${product.slug}`} className="flex flex-1 gap-6">
        <div className="relative flex aspect-[4/5] w-40 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-xs text-neutral-400 sm:w-52">
          {product.primaryImage ? (
            <Image
              src={product.primaryImage.url}
              alt={product.primaryImage.alt ?? product.name}
              fill
              unoptimized
              sizes="(min-width: 640px) 208px, 160px"
              className="rounded-lg object-cover"
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
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-base font-medium text-neutral-900">{product.name}</p>
        </div>
      </Link>

      <div className="w-32 shrink-0 sm:w-40">
        <PriceSection product={product} />
      </div>
    </article>
  );
}

function DetailedCategoryProductCard({ product }: { product: PublicProductListItem }) {
  const isOutOfStock = product.availability === "out_of_stock";
  const href = `/products/${product.slug}`;

  return (
    <article className="flex gap-4 border-b border-neutral-200 py-6 first:pt-0 last:border-b-0 sm:gap-6 md:items-start">
      {/* Column 1 (image) + column 2 (title + specs, desktop only) — one link */}
      <Link href={href} className="flex min-w-0 gap-4 sm:gap-6 md:flex-1">
        <div className="relative flex aspect-[4/5] w-28 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-xs text-neutral-400 sm:w-40 md:w-44">
          {product.primaryImage ? (
            <Image
              src={product.primaryImage.url}
              alt={product.primaryImage.alt ?? product.name}
              fill
              unoptimized
              sizes="(min-width: 768px) 176px, (min-width: 640px) 160px, 112px"
              className="rounded-lg object-cover"
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
        <div className="hidden min-w-0 flex-1 flex-col gap-2 md:flex">
          <p className="text-base font-medium text-neutral-900">{product.name}</p>
          <ul className="mt-1 space-y-1 text-xs text-neutral-500">
            {product.cardSpecifications.map((spec) => (
              <li key={spec.name}>
                {spec.name}: {spec.value}
                {spec.unit ? ` ${spec.unit}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </Link>

      {/* Column 3 (price). On mobile the product title stacks below it. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:w-40 md:flex-none">
        <PriceSection product={product} />
        <Link href={href} className="md:hidden">
          <p className="text-sm font-medium text-neutral-900">{product.name}</p>
        </Link>
      </div>

      {/* Column 4 — reserved, desktop only */}
      <div className="hidden md:block md:w-24 md:shrink-0" aria-hidden="true" />
    </article>
  );
}
