import { Checkbox } from "@/components/form/Checkbox";
import { Table } from "@/components/ui/Table";
import type { SpecificationField, SpecificationFieldType, SpecificationGroup } from "./types";

const FIELD_TYPES: SpecificationFieldType[] = ["text", "number", "boolean", "enum"];

export interface SpecificationGroupCardProps {
  group: SpecificationGroup;
  onRenameGroup: (newName: string) => void;
  onDeleteGroup: () => void;
  onAddField: () => void;
  onFieldChange: (fieldIndex: number, field: SpecificationField) => void;
  onToggleFilterable: (fieldIndex: number, field: SpecificationField) => void;
  onDeleteField: (fieldIndex: number) => void;
  onMoveField: (fieldIndex: number, direction: -1 | 1) => void;
}

export const SpecificationGroupCard = ({
  group,
  onRenameGroup,
  onDeleteGroup,
  onAddField,
  onFieldChange,
  onToggleFilterable,
  onDeleteField,
  onMoveField,
}: SpecificationGroupCardProps) => {
  function updateField(index: number, patch: Partial<SpecificationField>) {
    const current = group.specifications[index]!;
    const next: SpecificationField = { ...current, ...patch };
    if (next.type !== "enum") next.options = undefined;
    if (next.type === "text") next.filterable = false;
    onFieldChange(index, next);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-900">
          Group:
          <input
            type="text"
            defaultValue={group.groupName}
            aria-label={`Group name for ${group.groupName}`}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next && next !== group.groupName) onRenameGroup(next);
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={onDeleteGroup}
          className="text-xs text-red-600 hover:underline"
        >
          Delete group
        </button>
      </div>

      <Table minWidthClassName="min-w-[720px]" bordered={false}>
        <thead className="text-left text-xs text-neutral-500">
          <tr className="border-b border-neutral-200">
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Field name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Unit</th>
            <th className="px-3 py-2 font-medium">Options</th>
            <th className="px-3 py-2 font-medium">Required</th>
            <th className="px-3 py-2 font-medium">Filterable</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {group.specifications.map((field, index) => (
            <tr key={field.name + index}>
              <td className="px-3 py-2 whitespace-nowrap text-neutral-400">
                <button
                  type="button"
                  onClick={() => onMoveField(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${field.name} up`}
                  className="disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveField(index, 1)}
                  disabled={index === group.specifications.length - 1}
                  aria-label={`Move ${field.name} down`}
                  className="ml-1 disabled:opacity-30"
                >
                  ↓
                </button>
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={field.name}
                  aria-label="Field name"
                  onChange={(event) => updateField(index, { name: event.target.value })}
                  className="w-32 rounded-md border border-neutral-300 px-2 py-1"
                />
              </td>
              <td className="px-3 py-2">
                <select
                  value={field.type}
                  aria-label={`Type for ${field.name}`}
                  onChange={(event) =>
                    updateField(index, { type: event.target.value as SpecificationFieldType })
                  }
                  className="rounded-md border border-neutral-300 px-2 py-1"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={field.unit ?? ""}
                  aria-label={`Unit for ${field.name}`}
                  onChange={(event) =>
                    updateField(index, { unit: event.target.value || undefined })
                  }
                  className="w-16 rounded-md border border-neutral-300 px-2 py-1"
                />
              </td>
              <td className="px-3 py-2">
                {field.type === "enum" ? (
                  <input
                    type="text"
                    value={(field.options ?? []).join(", ")}
                    aria-label={`Options for ${field.name}`}
                    placeholder="e.g. 6GB, 8GB, 12GB"
                    onChange={(event) =>
                      updateField(index, {
                        options: event.target.value
                          .split(",")
                          .map((option) => option.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-40 rounded-md border border-neutral-300 px-2 py-1"
                  />
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <Checkbox
                  label={`Required: ${field.name}`}
                  visuallyHiddenLabel
                  checked={field.required}
                  onChange={(event) => updateField(index, { required: event.target.checked })}
                />
              </td>
              <td className="px-3 py-2">
                <Checkbox
                  label={`Filterable: ${field.name}`}
                  visuallyHiddenLabel
                  checked={field.filterable}
                  disabled={field.type === "text"}
                  className="disabled:opacity-30"
                  onChange={(event) =>
                    onToggleFilterable(index, { ...field, filterable: event.target.checked })
                  }
                />
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onDeleteField(index)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <button
        type="button"
        onClick={onAddField}
        className="w-full border-t border-neutral-100 px-3 py-2 text-left text-xs font-medium text-primary-600 hover:bg-primary-50"
      >
        + Add field
      </button>
    </div>
  );
};
