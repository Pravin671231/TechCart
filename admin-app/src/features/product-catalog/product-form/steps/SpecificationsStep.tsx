import { useFormContext } from "react-hook-form";
import { FormField } from "@/components/form/FormField";
import { TextInput } from "@/components/form/TextInput";
import { Select } from "@/components/form/Select";
import { Checkbox } from "@/components/form/Checkbox";
import { mockCategorySchema } from "@/features/product-catalog/product-form/mockCategorySchema";
import type { ProductFormValues } from "@/features/product-catalog/product-form/productFormSchema";
import type { SpecField } from "@/features/product-catalog/product-form/types";

export function SpecificationsStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ProductFormValues>();

  function renderField(field: SpecField) {
    const path = `specs.${field.name}` as const;
    const label = field.unit ? `${field.name} (${field.type}, ${field.unit})` : `${field.name} (${field.type})`;
    const fieldError = (errors.specs as Record<string, { message?: string }> | undefined)?.[field.name]
      ?.message;

    if (field.type === "boolean") {
      return (
        <Checkbox
          key={field.name}
          id={path}
          label={field.required ? `${field.name} *` : field.name}
          {...register(path)}
        />
      );
    }

    if (field.type === "enum") {
      return (
        <FormField key={field.name} label={label} htmlFor={path} required={field.required} error={fieldError}>
          <Select
            id={path}
            options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
            placeholder={`Select ${field.name}`}
            hasError={!!fieldError}
            {...register(path)}
          />
        </FormField>
      );
    }

    return (
      <FormField key={field.name} label={label} htmlFor={path} required={field.required} error={fieldError}>
        <TextInput
          id={path}
          type={field.type === "number" ? "number" : "text"}
          hasError={!!fieldError}
          {...register(path, field.type === "number" ? { valueAsNumber: true } : {})}
        />
      </FormField>
    );
  }

  return (
    <div>
      <p className="mb-4 text-[11px] text-neutral-400">
        These inputs are rendered from <strong>{mockCategorySchema.label}</strong>&apos;s schema, not
        a fixed field list — change the category above and this section re-renders · FR-CAT-033.
      </p>

      {mockCategorySchema.specGroups.map((group) => (
        <section key={group.groupName} className="mb-4">
          <p className="mb-2 text-sm font-medium text-neutral-800">{group.groupName}</p>
          <div className="grid gap-3 sm:grid-cols-2">{group.fields.map(renderField)}</div>
        </section>
      ))}
    </div>
  );
}
