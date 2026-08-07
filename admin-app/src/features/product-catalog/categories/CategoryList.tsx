import { Fragment, useState } from "react";
import { getApiErrorEnvelope } from "@/store/api";
import { EmptyRow, Table, TableHeadRow } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LoadingState } from "@/components/ui/LoadingState";
import { SearchInput } from "@/components/form/SearchInput";
import {
  useDeleteCategoryMutation,
  useGetCategoriesQuery,
  useUpdateCategoryStatusMutation,
} from "./categoriesApi";
import type { CategoryListItem } from "./types";

export interface CategoryListProps {
  search: string;
  onSearchChange: (value: string) => void;
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

export function CategoryList({ search, onSearchChange, onEdit }: CategoryListProps) {
  const { data: categories = [], isLoading } = useGetCategoriesQuery(search ? { search } : undefined);
  const [deleteCategory] = useDeleteCategoryMutation();
  const [updateCategoryStatus] = useUpdateCategoryStatusMutation();
  const [deleteGuard, setDeleteGuard] = useState<{ id: string; message: string } | null>(null);

  const orderedCategories = orderAsTree(categories);
  const nameById = new Map(categories.map((c) => [c._id, c.name]));

  async function handleDelete(category: CategoryListItem) {
    setDeleteGuard(null);
    try {
      await deleteCategory(category._id).unwrap();
    } catch (err) {
      const envelope = getApiErrorEnvelope(err);
      setDeleteGuard({ id: category._id, message: envelope?.message ?? "Unable to delete category." });
    }
  }

  async function handleToggleStatus(category: CategoryListItem) {
    await updateCategoryStatus({ id: category._id, status: !category.status }).unwrap();
  }

  return (
    <section className="min-w-0 flex-1">
      <SearchInput
        id="category-search"
        label="Search categories"
        placeholder="Search by name…"
        value={search}
        onChange={onSearchChange}
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="mt-4">
          <Table minWidthClassName="min-w-[640px]">
            <TableHeadRow>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Parent</th>
              <th className="px-3 py-2 text-right">Products</th>
              <th className="px-3 py-2 text-right">Sort</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </TableHeadRow>
            <tbody>
              {orderedCategories.map((category) => {
                const isChild = Boolean(category.parentCategory);
                const parentName = category.parentCategory ? nameById.get(category.parentCategory) : undefined;
                return (
                  <Fragment key={category._id}>
                    <tr className="border-b border-neutral-100">
                      <td className={`px-3 py-2 font-medium text-neutral-900 ${isChild ? "pl-8" : ""}`}>
                        {isChild ? `↳ ${category.name}` : category.name}
                      </td>
                      <td className="px-3 py-2 text-neutral-500">{parentName ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{category.productCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{category.sortOrder}</td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={category.status ? "success" : "neutral"}
                          shape="pill"
                          onClick={() => void handleToggleStatus(category)}
                        >
                          {category.status ? "Active" : "Inactive"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onEdit(category)}
                          className="mr-3 text-primary-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(category)}
                          className="text-primary-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {deleteGuard?.id === category._id && (
                      <tr>
                        <td colSpan={6} className="px-3 py-2">
                          <InlineAlert>{deleteGuard.message}</InlineAlert>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {orderedCategories.length === 0 && <EmptyRow colSpan={6} message="No categories found." />}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}
