import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/features/products/money";
import type { PublicProductListItem } from "@/features/products/types";

export function CategoryProductCard({ product }: { product: PublicProductListItem }) {
  const isOutOfStock = product.availability === "out_of_stock";

  return (
    <Link
      href={`/products/${product.slug}`}
      className="flex gap-6 border-b border-neutral-200 py-6 first:pt-0 last:border-b-0"
    >
      <article className="flex flex-1 gap-6">
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
          {product.cardSpecifications.length > 0 && (
            <ul className="mt-1 space-y-1 text-xs text-neutral-500">
              {product.cardSpecifications.map((spec) => (
                <li key={spec.name}>
                  {spec.name}: {spec.value}
                  {spec.unit ? ` ${spec.unit}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex w-32 shrink-0 flex-col items-start gap-0.5 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-right sm:w-40">
          {product.discount > 0 ? (
            <>
              <p className="text-lg font-bold text-neutral-900">
                {formatPrice(product.sellingPrice)}
              </p>
              <p className="text-xs text-neutral-400 line-through">{formatPrice(product.mrp)}</p>
              <span className="rounded-md bg-accent-100 px-1.5 py-0.5 text-[10px] font-medium text-accent-700">
                {product.discount}% off
              </span>
            </>
          ) : (
            <p className="text-lg font-bold text-neutral-900">
              {formatPrice(product.sellingPrice)}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
