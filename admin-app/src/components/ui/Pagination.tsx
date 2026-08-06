import type { Pagination as PaginationData } from "@/store/api";

export interface PaginationProps {
  page: number;
  pagination: PaginationData;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pagination, onPageChange }: PaginationProps) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <p className="text-neutral-500">
        Showing {(pagination.page - 1) * pagination.limit + 1}–
        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
      </p>
      <nav className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-neutral-200 px-3 py-1 text-neutral-500 disabled:cursor-not-allowed disabled:text-neutral-300"
        >
          ‹ Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!pagination.hasNextPage}
          className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
        >
          Next ›
        </button>
      </nav>
    </div>
  );
}
