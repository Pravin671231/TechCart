import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
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
      <PageHeader
        title="Categories"
        actions={
          <Button
            onClick={() => {
              setSelectedCategory(null);
              setIsCreating(true);
            }}
          >
            + New category
          </Button>
        }
      />

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
