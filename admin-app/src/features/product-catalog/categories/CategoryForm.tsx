import { useEffect, useState, type FormEvent } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { Button } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { ReadOnlyField, SelectField, TextAreaField, TextField } from "@/components/form/FormField";
import { SingleImageUploader } from "@/features/uploads/SingleImageUploader";
import { useCreateCategoryMutation, useUpdateCategoryMutation } from "./categoriesApi";
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
    <Card className="w-full shrink-0 xl:w-96">
      <CardHeading>{category ? "Edit category" : "New category"}</CardHeading>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          id="category-name"
          label="Name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        {category && <ReadOnlyField label="Slug" value={category.slug} mono />}

        <SelectField
          id="category-parent"
          label="Parent category"
          value={parentCategory ?? ""}
          onChange={(event) => setParentCategory(event.target.value)}
          hint="Only top-level categories are selectable · FR-CAT-014"
          error={saveError ? (saveError.message ?? "Unable to save category.") : undefined}
        >
          <option value="">— None (top-level) —</option>
          {parentOptions.map((option) => (
            <option key={option._id} value={option._id}>
              {option.name}
            </option>
          ))}
        </SelectField>

        <SingleImageUploader
          label="Image"
          purpose="category-image"
          previewUrl={category?.image?.url}
          onUploaded={(result) => setImage(result)}
        />

        <TextField
          id="category-sort-order"
          label="Sort order"
          type="number"
          value={sortOrder}
          onChange={(event) => setSortOrder(Number(event.target.value))}
        />

        <TextAreaField
          id="category-description"
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <TextField
          id="category-meta-title"
          label="Meta title"
          type="text"
          value={metaTitle}
          onChange={(event) => setMetaTitle(event.target.value)}
        />

        <TextAreaField
          id="category-meta-description"
          label="Meta description"
          value={metaDescription}
          onChange={(event) => setMetaDescription(event.target.value)}
        />

        <div className="flex gap-2">
          <Button type="submit" loading={isSaving} loadingLabel="Saving…">
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
