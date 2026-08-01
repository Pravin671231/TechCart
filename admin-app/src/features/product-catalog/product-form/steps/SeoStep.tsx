import { useFormContext } from "react-hook-form";
import { FormField } from "@/components/form/FormField";
import { TextInput } from "@/components/form/TextInput";
import { Textarea } from "@/components/form/Textarea";
import type { ProductFormValues } from "@/features/product-catalog/product-form/productFormSchema";

export function SeoStep() {
  const { register } = useFormContext<ProductFormValues>();

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Meta title" htmlFor="seo.metaTitle">
          <TextInput
            id="seo.metaTitle"
            placeholder="Defaults to the product name"
            {...register("seo.metaTitle")}
          />
        </FormField>

        <FormField label="Meta description" htmlFor="seo.metaDescription">
          <Textarea
            id="seo.metaDescription"
            placeholder="Defaults to a truncation of the description"
            {...register("seo.metaDescription")}
          />
        </FormField>
      </div>

      <p className="mt-3 text-[11px] text-neutral-400">
        Both are optional; buyer pages fall back when either is absent · FR-CAT-012.
      </p>
    </div>
  );
}
