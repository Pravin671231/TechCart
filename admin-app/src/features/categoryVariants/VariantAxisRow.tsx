import { Checkbox } from "@/components/ui/Checkbox";
import type { VariantAxis, VariantAxisType } from "./types";

const AXIS_TYPES: VariantAxisType[] = ["text", "select", "color", "number"];

function formatOptions(options: VariantAxis["options"]): string {
  return (options ?? []).map((option) => `${option.label}/${option.value}`).join(", ");
}

function parseOptions(text: string): VariantAxis["options"] {
  const pairs = text
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [label, value] = pair.split("/").map((part) => part.trim());
      return { label: label ?? "", value: value ?? label ?? "" };
    })
    .filter((option) => option.label.length > 0);
  return pairs.length > 0 ? pairs : undefined;
}

export function VariantAxisRow({
  axis,
  onChange,
  onToggleRequired,
  onDelete,
}: {
  axis: VariantAxis;
  onChange: (axis: VariantAxis) => void;
  onToggleRequired: (axis: VariantAxis) => void;
  onDelete: () => void;
}) {
  function update(patch: Partial<VariantAxis>) {
    const next: VariantAxis = { ...axis, ...patch };
    if (next.type !== "select" && next.type !== "color") next.options = undefined;
    onChange(next);
  }

  const usesOptions = axis.type === "select" || axis.type === "color";

  return (
    <tr>
      <td className="px-3 py-2">
        <input
          type="text"
          value={axis.name}
          aria-label="Axis name"
          onChange={(event) => update({ name: event.target.value })}
          className="w-32 rounded-md border border-neutral-300 px-2 py-1"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={axis.code}
          aria-label={`Code for ${axis.name}`}
          onChange={(event) => update({ code: event.target.value })}
          className="w-24 rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={axis.type}
          aria-label={`Type for ${axis.name}`}
          onChange={(event) => update({ type: event.target.value as VariantAxisType })}
          className="rounded-md border border-neutral-300 px-2 py-1"
        >
          {AXIS_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <Checkbox
          label={`Required: ${axis.name}`}
          visuallyHiddenLabel
          checked={axis.required}
          onChange={() => onToggleRequired({ ...axis, required: !axis.required })}
        />
      </td>
      <td className="px-3 py-2">
        {usesOptions ? (
          <input
            type="text"
            value={formatOptions(axis.options)}
            aria-label={`Options for ${axis.name}`}
            placeholder="e.g. Black/#000, Silver/#c0c0c0"
            onChange={(event) => update({ options: parseOptions(event.target.value) })}
            className="w-64 rounded-md border border-neutral-300 px-2 py-1 text-xs"
          />
        ) : (
          <span className="text-neutral-400">— not used for {axis.type}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <button type="button" onClick={onDelete} className="text-xs text-red-600 hover:underline">
          Delete
        </button>
      </td>
    </tr>
  );
}
