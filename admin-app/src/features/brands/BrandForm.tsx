import { useEffect, useState, type FormEvent } from "react";
import { getApiErrorEnvelope } from "@/store/api";
import { useCreateBrandMutation, useUpdateBrandMutation } from "./brandsApi";
import { LogoUploader } from "./LogoUploader";
import type { Brand, CreateBrandInput } from "./types";

export interface BrandFormProps {
  brand: Brand | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function BrandForm({ brand, onSaved, onCancel }: BrandFormProps) {
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
    <section className="w-full shrink-0 rounded-lg border border-neutral-200 p-4 xl:w-96">
      <h2 className="text-xs font-semibold uppercase text-neutral-700">
        {brand ? "Edit brand" : "New brand"}
      </h2>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-4">
        <div>
          <label htmlFor="brand-name" className="block text-sm font-medium text-neutral-700">
            Name
          </label>
          <input
            id="brand-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
          />
        </div>

        {brand && (
          <div>
            <span className="block text-sm font-medium text-neutral-700">Slug</span>
            <span className="mt-1 block rounded-md bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-500">
              {brand.slug}
            </span>
          </div>
        )}

        <LogoUploader
          previewUrl={brand?.logo?.url}
          onUploaded={(result) => setLogo(result)}
        />

        <div>
          <label htmlFor="brand-description" className="block text-sm font-medium text-neutral-700">
            Description
          </label>
          <textarea
            id="brand-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 block h-20 w-full rounded-md border border-neutral-400 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
          />
        </div>

        {saveError && (
          <p role="alert" className="text-[11px] text-red-600">
            {saveError.message ?? "Unable to save brand."}
          </p>
        )}

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
