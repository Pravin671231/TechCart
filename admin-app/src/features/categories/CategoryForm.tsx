import { useEffect, useState, type FormEvent } from "react";
import { getApiErrorEnvelope } from "@/store/api";
import { useCreateCategoryMutation, useUpdateCategoryMutation } from "./categoriesApi";
import { ImageUploader } from "./ImageUploader";
import type { Category, CategoryListItem, CreateCategoryInput, UpdateCategoryInput } from "./types";

export interface CategoryFormProps {
  category: Category | null;
  allCategories: CategoryListItem[];
  onSaved: () => void;
  onCancel: () => void;
}

export function CategoryForm({ category, allCategories, onSaved, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [parentCategory, setParentCategory] = useState(category?.parentCategory ?? "");
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0);
  const [metaTitle, setMetaTitle] = useState(category?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(category?.metaDescription ?? "");
  const [image, setImage] = useState<{ objectKey: string; publicUrl: string } | null>(null);

  const [createCategory, { isLoading: isCreating, error: createError }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: isUpdating, error: updateError }] = useUpdateCategoryMutation();

  useEffect(() => {
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setParentCategory(category?.parentCategory ?? "");
    setSortOrder(category?.sortOrder ?? 0);
    setMetaTitle(category?.metaTitle ?? "");
    setMetaDescription(category?.metaDescription ?? "");
    setImage(null);
  }, [category]);

  const isSaving = isCreating || isUpdating;
  const saveError = getApiErrorEnvelope(createError ?? updateError);

  const parentOptions = allCategories.filter(
    (candidate) => !candidate.parentCategory && candidate._id !== category?._id,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const trimmedDescription = description.trim();
    const trimmedMetaTitle = metaTitle.trim();
    const trimmedMetaDescription = metaDescription.trim();

    const shared = {
      name: trimmedName,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      ...(image ? { image: { objectKey: image.objectKey } } : {}),
      sortOrder,
      ...(trimmedMetaTitle ? { metaTitle: trimmedMetaTitle } : {}),
      ...(trimmedMetaDescription ? { metaDescription: trimmedMetaDescription } : {}),
    };

    try {
      if (category) {
        const patch: UpdateCategoryInput = { ...shared, parentCategory: parentCategory || null };
        await updateCategory({ id: category._id, patch }).unwrap();
      } else {
        const payload: CreateCategoryInput = {
          ...shared,
          ...(parentCategory ? { parentCategory } : {}),
        };
        await createCategory(payload).unwrap();
      }
      onSaved();
    } catch {
      // surfaced via saveError below
    }
  }

  return (
    <section className="w-full shrink-0 rounded-lg border border-neutral-200 p-4 xl:w-96">
      <h2 className="text-xs font-semibold uppercase text-neutral-700">
        {category ? "Edit category" : "New category"}
      </h2>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-4">
        <div>
          <label htmlFor="category-name" className="block text-sm font-medium text-neutral-700">
            Name
          </label>
          <input
            id="category-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
          />
        </div>

        {category && (
          <div>
            <span className="block text-sm font-medium text-neutral-700">Slug</span>
            <span className="mt-1 block rounded-md bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-500">
              {category.slug}
            </span>
          </div>
        )}

        <div>
          <label htmlFor="category-parent" className="block text-sm font-medium text-neutral-700">
            Parent category
          </label>
          <select
            id="category-parent"
            value={parentCategory ?? ""}
            onChange={(event) => setParentCategory(event.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
          >
            <option value="">— None (top-level) —</option>
            {parentOptions.map((option) => (
              <option key={option._id} value={option._id}>
                {option.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-neutral-400">
            Only top-level categories are selectable · FR-CAT-014
          </p>
          {saveError && (
            <p role="alert" className="mt-1 text-[11px] text-red-600">
              {saveError.message ?? "Unable to save category."}
            </p>
          )}
        </div>

        <ImageUploader previewUrl={category?.image?.url} onUploaded={(result) => setImage(result)} />

        <div>
          <label htmlFor="category-sort-order" className="block text-sm font-medium text-neutral-700">
            Sort order
          </label>
          <input
            id="category-sort-order"
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(Number(event.target.value))}
            className="mt-1 block w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="category-description" className="block text-sm font-medium text-neutral-700">
            Description
          </label>
          <textarea
            id="category-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 block h-20 w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="category-meta-title" className="block text-sm font-medium text-neutral-700">
            Meta title
          </label>
          <input
            id="category-meta-title"
            type="text"
            value={metaTitle}
            onChange={(event) => setMetaTitle(event.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="category-meta-description" className="block text-sm font-medium text-neutral-700">
            Meta description
          </label>
          <textarea
            id="category-meta-description"
            value={metaDescription}
            onChange={(event) => setMetaDescription(event.target.value)}
            className="mt-1 block h-20 w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-400 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
