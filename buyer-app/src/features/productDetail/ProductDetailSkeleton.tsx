export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2" aria-hidden="true">
      <div className="aspect-square animate-pulse rounded-lg bg-neutral-100" />
      <div className="flex flex-col gap-4">
        <div className="h-7 w-2/3 animate-pulse rounded-md bg-neutral-100" />
        <div className="h-4 w-1/3 animate-pulse rounded-md bg-neutral-100" />
        <div className="h-8 w-1/2 animate-pulse rounded-md bg-neutral-100" />
        <div className="h-32 w-full animate-pulse rounded-lg bg-neutral-100" />
      </div>
    </div>
  );
}
