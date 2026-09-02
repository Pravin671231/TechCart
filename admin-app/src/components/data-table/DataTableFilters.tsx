import { useId } from "react";
import type { DataTableFiltersConfig, SelectFilterField } from "./types";

/**
 * Config-driven filter row. The consumer declares `fields` (v1: `select` only)
 * plus the current `values` and an `onChange(key, value)`; this renders each
 * control and an automatic "Clear filters" button (shown only when something is
 * set, clears every field to `""`).
 */
export const DataTableFilters = ({
  fields,
  values,
  onChange,
  clearLabel = "Clear filters",
}: DataTableFiltersConfig) => {
  const anyActive = fields.some((field) => (values[field.key] ?? "") !== "");

  return (
    <>
      {fields.map((field) => (
        <SelectFilter
          key={field.key}
          field={field}
          value={values[field.key] ?? ""}
          onChange={onChange}
        />
      ))}

      {anyActive && (
        <button
          type="button"
          onClick={() => fields.forEach((field) => onChange(field.key, ""))}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          {clearLabel}
        </button>
      )}
    </>
  );
};

interface SelectFilterProps {
  field: SelectFilterField;
  value: string;
  onChange: (key: string, value: string) => void;
}

const SelectFilter = ({ field, value, onChange }: SelectFilterProps) => {
  const selectId = useId();
  return (
    <div className="flex items-center">
      <label htmlFor={selectId} className="sr-only">
        {field.label}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange(field.key, event.target.value)}
        className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-600 focus:border-primary-600 focus:outline-none"
      >
        <option value="">{field.placeholder ?? "All"}</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
