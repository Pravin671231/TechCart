import { useEffect, useState, type FormEvent } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { Button } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { ReadOnlyField, TextAreaField, TextField } from "@/components/form/FormField";
import { SingleImageUploader } from "@/features/uploads/SingleImageUploader";
import { useCreateBrandMutation, useUpdateBrandMutation } from "./brandsApi";
import type { Brand, CreateBrandInput } from "./types";

export interface BrandFormProps {
  brand: Brand | null;
  onSaved: () => void;
  onCancel: () => void;
}

export const BrandForm = ({ brand, onSaved, onCancel }: BrandFormProps) => {
  const [name, setName] = useState(brand?.name ?? "");
  const [description, setDescription] = useState(brand?.description ?? "");
  const [logo, setLogo] = useState<{ objectKey: string; publicUrl: string } | null>(null);

  const [createBrand, { isLoading: isCreating, error: createError }] = useCreateBrandMutation();
  const [updateBrand, { isLoading: isUpdating, error: updateError }] = useUpdateBrandMutation();

  useEffect(() => {
    setName(brand?.name ?? "");
    setDescription(brand?.description ?? "");
    setLogo(null);
  }, [brand]);

  const isSaving = isCreating || isUpdating;
  const saveError = getApiErrorEnvelope(createError ?? updateError);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const trimmedDescription = description.trim();
    const payload: CreateBrandInput = {
      name: trimmedName,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      ...(logo ? { logo: { objectKey: logo.objectKey } } : {}),
    };

    try {
      if (brand) {
        await updateBrand({ id: brand._id, patch: payload }).unwrap();
      } else {
        await createBrand(payload).unwrap();
      }
      onSaved();
    } catch {
      // surfaced via saveError below
    }
  }

  return (
    <Card className="w-full shrink-0 xl:w-96">
      <CardHeading>{brand ? "Edit brand" : "New brand"}</CardHeading>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          id="brand-name"
          label="Name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        {brand && <ReadOnlyField label="Slug" value={brand.slug} mono />}

        <SingleImageUploader
          label="Logo"
          purpose="brand-logo"
          previewUrl={brand?.logo?.url}
          onUploaded={(result) => setLogo(result)}
        />

        <TextAreaField
          id="brand-description"
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {saveError && (
          <p role="alert" className="text-[11px] text-red-600">
            {saveError.message ?? "Unable to save brand."}
          </p>
        )}

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
};
