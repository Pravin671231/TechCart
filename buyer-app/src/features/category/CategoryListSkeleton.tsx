import { SkeletonBox } from "@/components/ui/SkeletonBox";

const SKELETON_ROW_COUNT = 4;

export function CategoryListSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
        <div
          key={index}
          className="flex gap-6 border-b border-neutral-200 py-6 first:pt-0 last:border-b-0"
        >
          <SkeletonBox className="aspect-[4/5] w-28 shrink-0 rounded-lg sm:w-40 md:w-44" />
          <div className="flex flex-1 flex-col gap-2">
            <SkeletonBox className="h-4 w-2/3 rounded-md" />
            <SkeletonBox className="h-3 w-1/3 rounded-md" />
          </div>
          <SkeletonBox className="h-20 w-32 shrink-0 rounded-lg sm:w-40" />
          <div className="hidden md:block md:w-24 md:shrink-0" />
        </div>
      ))}
    </div>
  );
}
