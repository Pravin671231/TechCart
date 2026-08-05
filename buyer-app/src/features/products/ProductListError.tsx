export function ProductListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center text-sm text-neutral-500">
      <p>Something went wrong loading products.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Retry
      </button>
    </div>
  );
}
