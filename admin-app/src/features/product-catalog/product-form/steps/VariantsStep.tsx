import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { FormField } from "@/components/form/FormField";
import { TextInput } from "@/components/form/TextInput";
import { Select } from "@/components/form/Select";
import { Checkbox } from "@/components/form/Checkbox";
import { ImageDropzone } from "@/features/product-catalog/product-form/components/ImageDropzone";
import { VariantSwatchPicker } from "@/features/product-catalog/product-form/components/VariantSwatchPicker";
import { mockCategorySchema } from "@/features/product-catalog/product-form/mockCategorySchema";
import type { ProductFormValues } from "@/features/product-catalog/product-form/productFormSchema";
import type { VariantRow } from "@/features/product-catalog/product-form/types";

function createBlankVariantRow(): VariantRow {
  const attributes: Record<string, string> = {};
  for (const axis of mockCategorySchema.variantAxes) {
    attributes[axis.name] = axis.options[0] ?? "";
  }
  return {
    id: crypto.randomUUID(),
    attributes,
    sku: "",
    mrp: 0,
    discount: 0,
    stock: 0,
    weight: undefined,
    active: true,
    images: [],
  };
}

type VariantRowCardProps = {
  index: number;
  onRemoveRow: () => void;
};

function VariantRowCard({ index, onRemoveRow }: VariantRowCardProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: `variants.rows.${index}.images`,
    keyName: "fieldId",
  });

  const rowError = errors.variants?.rows?.[index] as { message?: string } | undefined;

  function handleAddImage(file?: File) {
    append({ id: crypto.randomUUID(), url: file ? URL.createObjectURL(file) : "", alt: "", isPrimary: false });
  }

  function handleRemoveImage(id: string) {
    const imageIndex = fields.findIndex((field) => field.id === id);
    if (imageIndex !== -1) remove(imageIndex);
  }

  function handleAltChange(id: string, alt: string) {
    const imageIndex = fields.findIndex((field) => field.id === id);
    if (imageIndex === -1) return;
    update(imageIndex, { ...fields[imageIndex], alt });
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-3">
      <div className="grid gap-3 sm:grid-cols-5">
        {mockCategorySchema.variantAxes.map((axis) => (
          <FormField key={axis.name} label={axis.name} htmlFor={`variants.rows.${index}.attributes.${axis.name}`}>
            {axis.type === "color" ? (
              <Controller
                control={control}
                name={`variants.rows.${index}.attributes.${axis.name}`}
                render={({ field }) => (
                  <VariantSwatchPicker options={axis.options} value={field.value} onChange={field.onChange} />
                )}
              />
            ) : (
              <Select
                id={`variants.rows.${index}.attributes.${axis.name}`}
                options={axis.options.map((option) => ({ value: option, label: option }))}
                {...register(`variants.rows.${index}.attributes.${axis.name}`)}
              />
            )}
          </FormField>
        ))}

        <FormField label="SKU" htmlFor={`variants.rows.${index}.sku`} required>
          <TextInput id={`variants.rows.${index}.sku`} mono {...register(`variants.rows.${index}.sku`)} />
        </FormField>

        <FormField label="MRP (₹)" htmlFor={`variants.rows.${index}.mrp`} required>
          <TextInput
            id={`variants.rows.${index}.mrp`}
            type="number"
            {...register(`variants.rows.${index}.mrp`, { valueAsNumber: true })}
          />
        </FormField>

        <FormField label="Discount %" htmlFor={`variants.rows.${index}.discount`}>
          <TextInput
            id={`variants.rows.${index}.discount`}
            type="number"
            {...register(`variants.rows.${index}.discount`, { valueAsNumber: true })}
          />
        </FormField>

        <FormField label="Stock" htmlFor={`variants.rows.${index}.stock`} required>
          <TextInput
            id={`variants.rows.${index}.stock`}
            type="number"
            {...register(`variants.rows.${index}.stock`, { valueAsNumber: true })}
          />
        </FormField>
      </div>

      {rowError?.message ? (
        <div className="mt-3 rounded-lg border border-danger-600 bg-danger-50 p-3">
          <p className="text-sm text-danger-700">{rowError.message}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
        <Checkbox id={`variants.rows.${index}.active`} label="Active" {...register(`variants.rows.${index}.active`)} />
        <label className="flex items-center gap-1">
          Weight (optional)
          <TextInput
            type="number"
            className="w-24"
            {...register(`variants.rows.${index}.weight`, { valueAsNumber: true })}
          />
        </label>
        <button
          type="button"
          onClick={onRemoveRow}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-neutral-600 hover:bg-neutral-50"
        >
          <LuTrash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs text-neutral-500">Images 0–2 (falls back to the product's)</p>
        <ImageDropzone
          images={fields}
          maxImages={2}
          minImages={0}
          compact
          onAdd={handleAddImage}
          onRemove={handleRemoveImage}
          onAltChange={handleAltChange}
        />
      </div>
    </div>
  );
}

export function VariantsStep() {
  const { control } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants.rows",
    keyName: "fieldId",
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-neutral-400">
        Variant controls are rendered from <strong>{mockCategorySchema.label}</strong>&apos;s variant
        axes · FR-CAT-038. No two variants may share an identical attribute set · FR-CAT-041.
        Removing a row here simply discards it before saving; once persisted, deactivating a variant
        is always a soft delete, never a hard removal · FR-CAT-040.
      </p>

      {fields.map((field, index) => (
        <VariantRowCard key={field.fieldId} index={index} onRemoveRow={() => remove(index)} />
      ))}

      <button
        type="button"
        onClick={() => append(createBlankVariantRow())}
        className="flex w-fit items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
      >
        <LuPlus className="h-4 w-4" />
        Add variant
      </button>
    </div>
  );
}
