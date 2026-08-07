import { Checkbox } from "@/components/form/Checkbox";
import { SelectField, TextField } from "@/components/form/FormField";
import { LoadingState } from "@/components/ui/LoadingState";
import { useGetCategorySpecificationsQuery } from "@/features/product-catalog/categorySpecifications/categorySpecificationsApi";
import type { SpecificationField } from "@/features/product-catalog/categorySpecifications/types";
import { specKey, type SpecificationValues } from "./specificationValues";

function FieldInput({
  groupName,
  field,
  value,
  onChange,
}: {
  groupName: string;
  field: SpecificationField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean | undefined) => void;
}) {
  const key = specKey(groupName, field.name);
  const label = (
    <>
      {field.name}
      {field.required ? " *" : ""}{" "}
      <em>
        ({field.type}
        {field.type !== "boolean" && field.type !== "enum" && field.unit ? `, ${field.unit}` : ""})
      </em>
    </>
  );

  if (field.type === "boolean") {
    return (
      <Checkbox
        label={label}
        id={key}
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }

  if (field.type === "enum") {
    return (
      <SelectField
        id={key}
        label={label}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">— select —</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
    );
  }

  return (
    <TextField
      id={key}
      label={label}
      type={field.type === "number" ? "number" : "text"}
      value={value === undefined ? "" : String(value)}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") {
          onChange(undefined);
        } else {
          onChange(field.type === "number" ? Number(raw) : raw);
        }
      }}
    />
  );
}

export function ProductSpecificationsFields({
  categoryId,
  values,
  onChange,
}: {
  categoryId: string;
  values: SpecificationValues;
  onChange: (key: string, value: string | number | boolean | undefined) => void;
}) {
  const { data, isLoading } = useGetCategorySpecificationsQuery(categoryId, { skip: !categoryId });

  if (!categoryId) {
    return (
      <p className="text-sm text-neutral-400">Choose a category to see its specification fields.</p>
    );
  }
  if (isLoading) return <LoadingState spaced={false} />;
  if (!data || data.specificationGroups.length === 0) {
    return (
      <p className="text-sm text-neutral-400">This category defines no specification fields.</p>
    );
  }

  return (
    <div className="space-y-4">
      {data.specificationGroups.map((group) => (
        <div key={group.groupName}>
          <p className="mb-2 text-sm font-medium text-neutral-900">{group.groupName}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.specifications.map((field) => (
              <FieldInput
                key={field.name}
                groupName={group.groupName}
                field={field}
                value={values[specKey(group.groupName, field.name)]}
                onChange={(value) => onChange(specKey(group.groupName, field.name), value)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
