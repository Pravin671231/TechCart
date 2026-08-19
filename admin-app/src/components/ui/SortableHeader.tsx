import { cn } from "@/lib/utils";

export interface SortableHeaderProps<TSort extends string> {
  label: string;
  sortKeyAsc: TSort;
  sortKeyDesc: TSort;
  currentSort: TSort | undefined;
  onSortChange: (sort: TSort | undefined) => void;
  align?: "left" | "right";
}

export const SortableHeader = <TSort extends string>({
  label,
  sortKeyAsc,
  sortKeyDesc,
  currentSort,
  onSortChange,
  align = "left",
}: SortableHeaderProps<TSort>) => {
  const isActive = currentSort === sortKeyAsc || currentSort === sortKeyDesc;
  const isDesc = currentSort === sortKeyDesc;

  function nextSort(): TSort | undefined {
    if (currentSort === sortKeyAsc) return sortKeyDesc;
    if (currentSort === sortKeyDesc) return undefined;
    return sortKeyAsc;
  }

  return (
    <th className={cn("px-3 py-2 font-medium text-neutral-500", align === "right" && "text-right")}>
      <button type="button" onClick={() => onSortChange(nextSort())}
        className={cn(
          "inline-flex items-center gap-1 hover:text-neutral-700",
          isActive && "text-neutral-900",
        )}
      >
        {label}
        <span aria-hidden="true">{!isActive ? "⇅" : isDesc ? "↓" : "↑"}</span>
      </button>
    </th>
  );
};
