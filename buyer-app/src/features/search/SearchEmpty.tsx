// FR-CAT-067: a keyword returning nothing and a keyword+filters combination
// returning nothing are distinct, successful empty responses (never a 404,
// FR-CAT-058) — the copy tells the buyer which lever to try relaxing.
export function SearchEmpty({ q, hasActiveFilters }: { q: string; hasActiveFilters: boolean }) {
  if (hasActiveFilters) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center text-sm text-neutral-500">
        No products match your filters
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-12 text-center text-sm">
      No results for &ldquo;{q}&rdquo;
    </div>
  );
}
