import { SkeletonBox } from "@/components/ui/SkeletonBox";

export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2" aria-hidden="true">
      <SkeletonBox className="aspect-square rounded-lg" />
      <div className="flex flex-col gap-4">
        <SkeletonBox className="h-7 w-2/3 rounded-md" />
        <SkeletonBox className="h-4 w-1/3 rounded-md" />
        <SkeletonBox className="h-8 w-1/2 rounded-md" />
        <SkeletonBox className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}
