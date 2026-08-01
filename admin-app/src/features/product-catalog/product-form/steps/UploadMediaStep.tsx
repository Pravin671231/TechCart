import { useFieldArray, useFormContext } from "react-hook-form";
import { ImageDropzone } from "@/features/product-catalog/product-form/components/ImageDropzone";
import type { ProductFormValues } from "@/features/product-catalog/product-form/productFormSchema";

export function UploadMediaStep() {
  const {
    control,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "media.images",
    keyName: "fieldId",
  });

  function handleAdd(file?: File) {
    append({
      id: crypto.randomUUID(),
      url: file ? URL.createObjectURL(file) : "",
      alt: "",
      isPrimary: fields.length === 0,
    });
  }

  function handleRemove(id: string) {
    const index = fields.findIndex((field) => field.id === id);
    if (index === -1) return;
    const wasPrimary = fields[index].isPrimary;
    const remaining = fields.filter((_, i) => i !== index);
    remove(index);
    // The first surviving image always lands at index 0 post-removal, regardless
    // of which index was removed — promote it if the removed image was primary.
    if (wasPrimary && remaining.length > 0) {
      update(0, { ...remaining[0], isPrimary: true });
    }
  }

  function handleSetPrimary(id: string) {
    fields.forEach((field, index) => {
      update(index, { ...field, isPrimary: field.id === id });
    });
  }

  function handleAltChange(id: string, alt: string) {
    const index = fields.findIndex((field) => field.id === id);
    if (index === -1) return;
    update(index, { ...fields[index], alt });
  }

  const errorMessage =
    errors.media?.images?.message ??
    (errors.media?.images as { root?: { message?: string } } | undefined)?.root?.message;

  return (
    <div>
      <ImageDropzone
        images={fields}
        maxImages={8}
        minImages={1}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onSetPrimary={handleSetPrimary}
        onAltChange={handleAltChange}
      />
      {errorMessage ? <p className="mt-3 text-xs text-danger-600">{errorMessage}</p> : null}
      <p className="mt-3 text-[11px] text-neutral-400">
        Upload goes direct to Cloudflare R2 via a 5-minute presigned URL; the backend never receives
        image bytes · FR-CAT-077, 080. Removing the primary promotes the first remaining image
        automatically · FR-CAT-084.
      </p>
    </div>
  );
}
