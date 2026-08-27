import { SkeletonBox } from "@/components/ui/SkeletonBox";

export function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 rounded-lg border border-neutral-200 p-4">
            <SkeletonBox className="h-24 w-24 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <SkeletonBox className="h-4 w-2/3" />
              <SkeletonBox className="h-3 w-1/3" />
              <SkeletonBox className="h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
      <SkeletonBox className="h-48 w-full rounded-lg" />
    </div>
  );
}
