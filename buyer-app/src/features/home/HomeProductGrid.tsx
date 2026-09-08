import { ProductCardSkeleton } from "@/features/products/ProductCardSkeleton";
import type { PublicProductListItem } from "@/features/products/types";
import { HomeProductCard } from "./HomeProductCard";

// Skeleton cards shown appended to the grid while the next infinite-scroll
// page loads — a small fixed batch, not a full page's worth.
const LOADING_MORE_SKELETON_COUNT = 4;

export function HomeProductGrid({
  products,
  isLoadingMore = false,
}: {
  products: PublicProductListItem[];
  isLoadingMore?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {products.map((product) => (
        <HomeProductCard key={product._id} product={product} />
      ))}
      {isLoadingMore &&
        Array.from({ length: LOADING_MORE_SKELETON_COUNT }).map((_, index) => (
          <ProductCardSkeleton key={`loading-more-${index}`} />
        ))}
    </div>
  );
}
