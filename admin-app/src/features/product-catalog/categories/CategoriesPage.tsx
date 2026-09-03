import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useGetCategoriesQuery } from "./categoriesApi";
import { CategoryForm } from "./CategoryForm";
import { CategoryList } from "./CategoryList";
import type { CategoryListItem } from "./types";

export const CategoriesPage = () => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryListItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: allCategoriesData } = useGetCategoriesQuery({ limit: 100 });
  const allCategories = allCategoriesData?.items ?? [];

  const showForm = isCreating || selectedCategory !== null;

  function closeForm() {
    setIsCreating(false);
    setSelectedCategory(null);
  }

  return (
    <main className="flex h-full min-h-0 flex-col p-6">
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

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
        <CategoryList
          onEdit={(category) => {
            setIsCreating(false);
            setSelectedCategory(category);
          }}
        />
        {showForm && (
          <div className="w-full shrink-0 overflow-y-auto xl:w-96">
            <CategoryForm
              category={isCreating ? null : selectedCategory}
              allCategories={allCategories}
              onSaved={closeForm}
              onCancel={closeForm}
            />
          </div>
        )}
      </div>
    </main>
  );
};
