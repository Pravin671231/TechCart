import Link from "next/link";
import type { PublicProductDetail } from "@/features/products/types";
import { VariantSelector } from "./VariantSelector";

// The product identity block — name, brand/category line, and (when the
// product has variants) the variant selector. Extracted from
// ProductDetailContent so the right column composes cleanly; price and
// availability deliberately live in ProductBuyBox, not here.
export function ProductInfo({
  product,
  selectedAttributes,
  onSelect,
}: {
  product: PublicProductDetail;
  selectedAttributes: Record<string, string>;
  onSelect: (axisName: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          {product.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          by <span className="text-primary-600">{product.brand.name}</span>
          <span className="mx-1">·</span>
          <Link
            className="text-primary-600 hover:underline"
            href={`/category/${product.category.slug}`}
          >
            {product.category.name}
          </Link>
        </p>
      </div>

      {product.hasVariants && (
        <VariantSelector
          variants={product.variants}
          selectedAttributes={selectedAttributes}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
