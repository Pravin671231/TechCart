const SKELETON_ROW_COUNT = 4;

export function CategoryListSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
        <div
          key={index}
          className="flex gap-6 border-b border-neutral-200 py-6 first:pt-0 last:border-b-0"
        >
          <div className="aspect-[4/5] w-40 shrink-0 animate-pulse rounded-lg bg-neutral-100 sm:w-52" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-2/3 animate-pulse rounded-md bg-neutral-100" />
            <div className="h-3 w-1/3 animate-pulse rounded-md bg-neutral-100" />
          </div>
          <div className="h-16 w-32 shrink-0 animate-pulse rounded-lg bg-neutral-100 sm:w-40" />
        </div>
      ))}
    </div>
  );
}
