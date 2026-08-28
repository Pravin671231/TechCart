import { SkeletonBox } from "@/components/ui/SkeletonBox";

export function AddressesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4">
          <SkeletonBox className="h-4 w-1/3" />
          <SkeletonBox className="h-3 w-2/3" />
          <SkeletonBox className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
