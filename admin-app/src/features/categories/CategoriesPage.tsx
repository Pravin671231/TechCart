import { useState } from "react";
import { useGetCategoriesQuery } from "./categoriesApi";
import { CategoryForm } from "./CategoryForm";
import { CategoryList } from "./CategoryList";
import type { CategoryListItem } from "./types";

export function CategoriesPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryListItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: allCategories = [] } = useGetCategoriesQuery(undefined);

  const showForm = isCreating || selectedCategory !== null;

  function closeForm() {
    setIsCreating(false);
    setSelectedCategory(null);
  }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <button
          type="button"
          onClick={() => {
            setSelectedCategory(null);
            setIsCreating(true);
          }}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + New category
        </button>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <CategoryList
          search={search}
          onSearchChange={setSearch}
          onEdit={(category) => {
            setIsCreating(false);
            setSelectedCategory(category);
          }}
        />
        {showForm && (
          <CategoryForm
            category={isCreating ? null : selectedCategory}
            allCategories={allCategories}
            onSaved={closeForm}
            onCancel={closeForm}
          />
        )}
      </div>
    </main>
  );
}
