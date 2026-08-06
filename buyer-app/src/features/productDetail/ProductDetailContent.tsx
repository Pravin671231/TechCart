"use client";

import { useState } from "react";
import Link from "next/link";
import { useGetProductBySlugQuery } from "@/features/products/api";
import { formatPrice } from "@/features/products/money";
import type { PublicProductVariant } from "@/features/products/types";
import type { NormalizedApiError } from "@/store/api";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { ProductDetailSkeleton } from "./ProductDetailSkeleton";
import { ProductGallery } from "./ProductGallery";
import { ProductNotFound } from "./ProductNotFound";
import { ProductSpecifications } from "./ProductSpecifications";
import { VariantSelector } from "./VariantSelector";

function attributesOf(variant: PublicProductVariant | undefined): Record<string, string> {
  if (!variant) return {};
  return Object.fromEntries(variant.attributes.map((a) => [a.name, a.value]));
}

// The active variant currently on display — an exact match across every
// selected axis when one exists, else the variant that shares the most
// recently changed axis value, else the first variant. Always resolves to
// *something* when variants exist, so the buy box never has nothing to show.
function pickVariant(
  variants: PublicProductVariant[],
  selectedAttributes: Record<string, string>,
): PublicProductVariant | undefined {
  if (variants.length === 0) return undefined;
  const exact = variants.find((variant) =>
    Object.entries(selectedAttributes).every(([name, value]) =>
      variant.attributes.some((a) => a.name === name && a.value === value),
    ),
  );
  if (exact) return exact;
  const partial = variants.find((variant) =>
    variant.attributes.some((a) => selectedAttributes[a.name] === a.value),
  );
  return partial ?? variants[0];
}

export function ProductDetailContent({ slug }: { slug: string }) {
  const { data: product, isLoading, isError, error, refetch } = useGetProductBySlugQuery(slug);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedForProductId, setSelectedForProductId] = useState<string | undefined>(undefined);

  // A new product (slug navigation) needs its selection reset to the default
  // variant — adjusted during render (React's documented pattern for
  // deriving state from a prop change) rather than in an effect, since an
  // effect would cause an extra, avoidable render.
  if (product && product._id !== selectedForProductId) {
    setSelectedForProductId(product._id);
    const defaultVariant = product.variants.find((v) => v._id === product.defaultVariantId);
    setSelectedAttributes(attributesOf(defaultVariant ?? product.variants[0]));
  }

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <ProductDetailSkeleton />
      </main>
    );
  }

  if (isError) {
    const code = (error as NormalizedApiError | undefined)?.code;
    const isNotFound = code === "PRODUCT_NOT_FOUND" || code === "INVALID_SLUG";
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {isNotFound ? (
          <ProductNotFound />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center text-sm text-neutral-500">
            <p>Something went wrong loading this product.</p>
            <button
              type="button"
              onClick={refetch}
              className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Retry
            </button>
          </div>
        )}
      </main>
    );
  }

  if (!product) return null;

  const selectedVariant = pickVariant(product.variants, selectedAttributes);
  const displayed = selectedVariant ?? product;
  const images = selectedVariant && selectedVariant.images.length > 0
    ? selectedVariant.images
    : product.images;

  function handleSelect(axisName: string, value: string) {
    setSelectedAttributes((prev) => ({ ...prev, [axisName]: value }));
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link className="hover:text-primary-600" href="/">
          Home
        </Link>
        <span className="mx-1 text-neutral-300">/</span>
        <Link className="hover:text-primary-600" href={`/category/${product.category.slug}`}>
          {product.category.name}
        </Link>
        <span className="mx-1 text-neutral-300">/</span>
        <span className="font-medium text-neutral-900">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={images} name={product.name} />

        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              {product.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              by <span className="text-primary-600">{product.brand.name}</span>
              <span className="mx-1">·</span>
              <Link className="text-primary-600 hover:underline" href={`/category/${product.category.slug}`}>
                {product.category.name}
              </Link>
            </p>
          </div>

          <div>
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold text-neutral-900">
                {formatPrice(displayed.sellingPrice)}
              </span>
              {displayed.discount > 0 && (
                <>
                  <span className="text-sm text-neutral-400 line-through">
                    {formatPrice(displayed.mrp)}
                  </span>
                  <span className="rounded-md bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
                    {displayed.discount}% off
                  </span>
                </>
              )}
            </p>
          </div>

          <p>
            <AvailabilityBadge availability={displayed.availability} />
          </p>

          {product.hasVariants && (
            <VariantSelector
              variants={product.variants}
              selectedAttributes={selectedAttributes}
              onSelect={handleSelect}
            />
          )}

          <div className="rounded-lg border border-dashed border-neutral-300 p-3 text-[11px] text-neutral-500">
            <strong className="text-neutral-600">No add-to-cart control in v0.2.</strong> The
            product detail page is read-only in this version.
          </div>
        </section>
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="mb-2 text-sm font-medium tracking-wide text-neutral-500 uppercase">
          Description
        </h2>
        <p className="text-sm text-neutral-700">{product.description}</p>
      </section>

      <ProductSpecifications groups={product.specifications} />
    </main>
  );
}
