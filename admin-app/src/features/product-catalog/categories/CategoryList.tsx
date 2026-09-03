import { useMemo, useState } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { AlertModal } from "@/components/ui/AlertModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useListQueryState } from "@/hooks/useListQueryState";
import {
  useDeleteCategoryMutation,
  useGetCategoriesQuery,
  useUpdateCategoryStatusMutation,
} from "./categoriesApi";
import type { CategoryListItem } from "./types";

export interface CategoryListProps {
  onEdit: (category: CategoryListItem) => void;
}

function sortByOrderThenName(a: CategoryListItem, b: CategoryListItem): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

function orderAsTree(categories: CategoryListItem[]): CategoryListItem[] {
  const roots = categories.filter((c) => !c.parentCategory).sort(sortByOrderThenName);
  const ordered: CategoryListItem[] = [];

  for (const root of roots) {
    ordered.push(root);
    const children = categories
      .filter((c) => c.parentCategory === root._id)
      .sort(sortByOrderThenName);
    ordered.push(...children);
  }

  const knownIds = new Set(ordered.map((c) => c._id));
  const orphans = categories.filter((c) => !knownIds.has(c._id));
  ordered.push(...orphans);

  return ordered;
}

export const CategoryList = ({ onEdit }: CategoryListProps) => {
  const { filters, setFilter, page, setPage, limit, setLimit } = useListQueryState<{
    search: string;
  }>({ search: "" });

  const { data, isLoading, isFetching, isError, refetch } = useGetCategoriesQuery({
    search: filters.search || undefined,
    page,
    limit,
  });
  // The tree ordering/parent-name lookup below only sees the current page's
  // slice, not every category — a child whose parent falls on a different
  // page renders as an unindented "orphan" with no resolvable parent name.
  // A known, accepted limitation of pairing pagination with a two-level
  // hierarchy view; still strictly better than the previous silent
  // hard-cap-at-20-with-no-pagination-at-all behavior.
  const categories = useMemo(() => data?.items ?? [], [data]);
  const total = data?.pagination.total ?? 0;

  const [deleteCategory, { isLoading: isDeleting }] = useDeleteCategoryMutation();
  const [updateCategoryStatus] = useUpdateCategoryStatusMutation();
  const [pendingDelete, setPendingDelete] = useState<CategoryListItem | null>(null);
  const [guardMessage, setGuardMessage] = useState<string | null>(null);

  const orderedCategories = useMemo(() => orderAsTree(categories), [categories]);
  const nameById = useMemo(() => new Map(categories.map((c) => [c._id, c.name])), [categories]);

  async function handleDelete(category: CategoryListItem) {
    try {
      await deleteCategory(category._id).unwrap();
    } catch (err) {
      const envelope = getApiErrorEnvelope(err);
      setGuardMessage(envelope?.message ?? "Unable to delete category.");
    }
  }

  async function handleToggleStatus(category: CategoryListItem) {
    await updateCategoryStatus({ id: category._id, status: !category.status }).unwrap();
  }

  const columns: DataTableColumn<CategoryListItem>[] = [
    {
      id: "name",
      header: "Name",
      cellClassName: (category) =>
        category.parentCategory
          ? "pl-8 font-medium text-neutral-900"
          : "font-medium text-neutral-900",
      cell: (category) => (category.parentCategory ? `↳ ${category.name}` : category.name),
    },
    {
      id: "parent",
      header: "Parent",
      cell: (category) =>
        category.parentCategory ? (nameById.get(category.parentCategory) ?? "—") : "—",
    },
    {
      id: "productCount",
      header: "Products",
      align: "right",
      cell: (category) => <span className="tabular-nums">{category.productCount}</span>,
    },
    {
      id: "sortOrder",
      header: "Sort",
      align: "right",
      cell: (category) => <span className="tabular-nums">{category.sortOrder}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (category) => (
        <StatusBadge
          tone={category.status ? "success" : "neutral"}
          shape="pill"
          onClick={() => void handleToggleStatus(category)}
        >
          {category.status ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (category) => (
        <span className="flex gap-3">
          <button
            type="button"
            onClick={() => onEdit(category)}
            className="text-primary-600 hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(category)}
            className="text-primary-600 hover:underline"
          >
            Delete
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable<CategoryListItem>
        className="min-h-0 flex-1"
        columns={columns}
        rows={orderedCategories}
        getRowId={(category) => category._id}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        onRetry={refetch}
        emptyMessage="No categories found."
        caption="Category list"
        minWidth="40rem"
        search={{
          label: "Search categories",
          placeholder: "Search by name…",
          defaultValue: filters.search,
          onSearch: (value) => setFilter("search", value),
        }}
        pagination={{ page, pageSize: limit, total }}
        onPaginationChange={({ page: nextPage, pageSize }) => {
          if (pageSize !== limit) setLimit(pageSize);
          else setPage(nextPage);
        }}
      />

      <AlertModal
        open={Boolean(pendingDelete)}
        title="Delete category"
        message={`Delete "${pendingDelete?.name}"? This can't be undone.`}
        isConfirming={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) void handleDelete(target);
        }}
      />

      <AlertModal
        open={Boolean(guardMessage)}
        variant="warning"
        title="Cannot delete category"
        message={guardMessage}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setGuardMessage(null)}
        onConfirm={() => setGuardMessage(null)}
      />
    </>
  );
};
