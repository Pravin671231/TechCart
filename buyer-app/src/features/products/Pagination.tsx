import type { Pagination as PaginationData } from "@/store/api";

export function describeRange(pagination: PaginationData): string {
  if (pagination.total === 0) {
    return "Showing 0 products";
  }
  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);
  return `Showing ${start}–${end} of ${pagination.total} products`;
}

// Issue #326 — the header count for infinite-scroll listings, where the
// rendered list has accumulated across pages rather than showing one slice.
export function describeLoadedCount(loaded: number, total: number): string {
  if (total === 0) return "Showing 0 products";
  return `Showing ${loaded} of ${total} products`;
}

export function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages } = pagination;

  return (
    <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-neutral-200 px-3 py-1 text-neutral-500 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
      >
        {"‹"} Prev
      </button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
        <button
          type="button"
          key={pageNumber}
          onClick={() => onPageChange(pageNumber)}
          aria-current={pageNumber === page ? "page" : undefined}
          className={
            pageNumber === page
              ? "rounded-md bg-primary-600 px-3 py-1 font-medium text-white"
              : "rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-50"
          }
        >
          {pageNumber}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
      >
        Next {"›"}
      </button>
    </nav>
  );
}
