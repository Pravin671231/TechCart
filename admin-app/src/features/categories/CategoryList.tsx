import { Fragment, useState } from "react";
import { getApiErrorEnvelope } from "@/store/api";
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
      <label htmlFor="category-search" className="sr-only">
        Search categories
      </label>
      <input
        id="category-search"
        type="text"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="h-9 w-64 rounded-md border border-neutral-300 px-3 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
      />

      {isLoading ? (
        <p className="mt-4 text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase text-neutral-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Parent</th>
                <th className="px-3 py-2 text-right">Products</th>
                <th className="px-3 py-2 text-right">Sort</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
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
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(category)}
                          className={
                            category.status
                              ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                              : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500"
                          }
                        >
                          {category.status ? "Active" : "Inactive"}
                        </button>
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
                          <div
                            role="alert"
                            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                          >
                            {deleteGuard.message}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {orderedCategories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-neutral-500">
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
