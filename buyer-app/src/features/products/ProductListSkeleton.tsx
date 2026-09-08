import { ProductCardSkeleton } from "./ProductCardSkeleton";

const SKELETON_CARD_COUNT = 8;

export function ProductListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
