import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
      <p>
        Showing {from}–{to} of {total}
      </p>

      <nav className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <LuChevronLeft className="h-4 w-4" />
        </button>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === page ? "page" : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
              pageNumber === page
                ? "bg-primary-600 text-white"
                : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <LuChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
