import { SkeletonBox } from "@/components/ui/SkeletonBox";

const SKELETON_CARD_COUNT = 8;

export function ProductListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 shadow-sm"
        >
          <SkeletonBox className="aspect-square" />
          <div className="flex flex-col gap-2 p-3">
            <SkeletonBox className="h-3 w-3/4 rounded-md" />
            <SkeletonBox className="h-3 w-1/3 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
