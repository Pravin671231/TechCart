import { SkeletonBox } from "@/components/ui/SkeletonBox";

// A single product-card placeholder, matching ProductCard's outer markup
// (bordered card + square image + text/price rows). Used both for the
// first-load grid (ProductListSkeleton) and appended into the home grid while
// the next infinite-scroll page loads (HomeProductGrid).
export function ProductCardSkeleton() {
  return (
    <div
      data-testid="product-card-skeleton"
      className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 shadow-sm"
    >
      <SkeletonBox className="aspect-square" />
      <div className="flex flex-col gap-2 p-3">
        <SkeletonBox className="h-3 w-3/4 rounded-md" />
        <SkeletonBox className="h-4 w-1/3 rounded-md" />
      </div>
    </div>
  );
}
