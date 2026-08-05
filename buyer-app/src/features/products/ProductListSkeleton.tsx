const SKELETON_CARD_COUNT = 8;

export function ProductListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 shadow-sm"
        >
          <div className="aspect-square animate-pulse bg-neutral-100" />
          <div className="flex flex-col gap-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded-md bg-neutral-100" />
            <div className="h-3 w-1/3 animate-pulse rounded-md bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
