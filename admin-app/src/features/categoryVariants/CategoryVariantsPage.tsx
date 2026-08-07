import { useState } from "react";
import { useGetCategoriesQuery } from "@/features/categories/categoriesApi";
import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryVariantEditor } from "./CategoryVariantEditor";

export function CategoryVariantsPage() {
  const { data: categories = [] } = useGetCategoriesQuery(undefined);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const categoryId = selectedCategoryId || categories[0]?._id || "";

  return (
    <main className="p-6">
      <PageHeader
        title="Variant axes"
        size="md"
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Category</span>
            <select
              value={categoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-600"
            >
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <p className="mb-4 text-[11px] text-neutral-400">
        One variant-type document per category — no axes until the first "Save axes".
      </p>

      {categoryId ? (
        <CategoryVariantEditor key={categoryId} categoryId={categoryId} />
      ) : (
        <p className="text-sm text-neutral-500">Create a category first.</p>
      )}
    </main>
  );
}
