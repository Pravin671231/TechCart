import { useGetCategorySpecificationsQuery } from "@/features/categorySpecifications/categorySpecificationsApi";
import type { SpecificationField } from "@/features/categorySpecifications/types";
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

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          id={key}
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        <span className="text-neutral-500">
          {field.name}
          {field.required ? " *" : ""} <em>(boolean)</em>
        </span>
      </label>
    );
  }

  if (field.type === "enum") {
    return (
      <label className="block text-sm">
        <span className="text-neutral-500">
          {field.name}
          {field.required ? " *" : ""} <em>(enum)</em>
        </span>
        <select
          id={key}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || undefined)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
        >
          <option value="">— select —</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block text-sm">
      <span className="text-neutral-500">
        {field.name}
        {field.required ? " *" : ""} <em>({field.type}{field.unit ? `, ${field.unit}` : ""})</em>
      </span>
      <input
        id={key}
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
        className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
      />
    </label>
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
    return <p className="text-sm text-neutral-400">Choose a category to see its specification fields.</p>;
  }
  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!data || data.specificationGroups.length === 0) {
    return <p className="text-sm text-neutral-400">This category defines no specification fields.</p>;
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
