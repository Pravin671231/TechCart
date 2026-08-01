import { useFormContext, useWatch } from "react-hook-form";
import { FormField } from "@/components/form/FormField";
import { TextInput } from "@/components/form/TextInput";
import { Textarea } from "@/components/form/Textarea";
import { Select } from "@/components/form/Select";
import { Checkbox } from "@/components/form/Checkbox";
import {
  mockBrandOptions,
  mockCategoryOptions,
} from "@/features/product-catalog/product-form/mockCategorySchema";
import type { ProductFormValues } from "@/features/product-catalog/product-form/productFormSchema";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductInformationStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const name = useWatch({ control, name: "info.name" });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Name" htmlFor="info.name" required error={errors.info?.name?.message}>
        <TextInput id="info.name" hasError={!!errors.info?.name} {...register("info.name")} />
      </FormField>

      <FormField
        label="Slug"
        htmlFor="info.slug"
        helperText="Auto-generated from the name; a numeric suffix is appended on collision · FR-CAT-002"
      >
        <TextInput id="info.slug" mono disabled value={slugify(name ?? "")} readOnly />
      </FormField>

      <FormField label="SKU" htmlFor="info.sku" required error={errors.info?.sku?.message}>
        <TextInput id="info.sku" mono hasError={!!errors.info?.sku} {...register("info.sku")} />
      </FormField>

      <FormField
        label="Brand"
        htmlFor="info.brand"
        required
        helperText="Required on every product · FR-CAT-029"
        error={errors.info?.brand?.message}
      >
        <Select
          id="info.brand"
          options={mockBrandOptions}
          placeholder="Select a brand"
          hasError={!!errors.info?.brand}
          {...register("info.brand")}
        />
      </FormField>

      <FormField
        label="Category"
        htmlFor="info.category"
        required
        helperText="Changing this re-validates the specifications below against the new schema · FR-CAT-034"
        error={errors.info?.category?.message}
      >
        <Select
          id="info.category"
          options={mockCategoryOptions}
          hasError={!!errors.info?.category}
          {...register("info.category")}
        />
      </FormField>

      <div className="flex items-end">
        <Checkbox id="info.isFeatured" label="Featured" {...register("info.isFeatured")} />
      </div>

      <div className="sm:col-span-2">
        <FormField
          label="Description"
          htmlFor="info.description"
          required
          error={errors.info?.description?.message}
        >
          <Textarea
            id="info.description"
            hasError={!!errors.info?.description}
            {...register("info.description")}
          />
        </FormField>
      </div>
    </div>
  );
}
