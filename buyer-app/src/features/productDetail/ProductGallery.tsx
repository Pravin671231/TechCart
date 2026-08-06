"use client";

import { useState } from "react";
import Image from "next/image";
import type { ProductImageRef } from "@/features/products/types";

export function ProductGallery({ images, name }: { images: ProductImageRef[]; name: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [renderedImages, setRenderedImages] = useState(images);

  // A variant switch hands this component a brand new images array — reset
  // the selection during render (React's documented pattern for adjusting
  // state on a prop change) rather than in an effect, which would cause an
  // extra, avoidable render.
  if (images !== renderedImages) {
    setRenderedImages(images);
    setSelectedIndex(0);
  }

  const selected = images[selectedIndex];

  return (
    <section>
      <div className="relative flex aspect-square items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-400">
        {selected ? (
          <Image
            src={selected.url}
            alt={selected.alt ?? name}
            fill
            unoptimized
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          "No image available"
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2">
          {images.map((image, index) => (
            <button
              key={image.url + index}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === selectedIndex}
              className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-neutral-50 ${
                index === selectedIndex ? "border-2 border-primary-600" : "border-neutral-200"
              }`}
            >
              <Image
                src={image.url}
                alt={image.alt ?? `${name} thumbnail ${index + 1}`}
                fill
                unoptimized
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
