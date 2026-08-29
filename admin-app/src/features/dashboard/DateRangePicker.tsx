import type { DateRangeParams } from "./types";

export interface DateRangePickerProps {
  value: DateRangeParams;
  onChange: (next: DateRangeParams) => void;
}

// Backend's own resolveDateRange() defaults to the last 30 days when both
// from/to are omitted — this control mirrors that default by starting with
// an empty {from, to} rather than pre-computing dates client-side.
export const DateRangePicker = ({ value, onChange }: DateRangePickerProps) => {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-sm">
        <span className="mb-1 font-medium text-neutral-700">From</span>
        <input
          type="date"
          value={value.from ?? ""}
          onChange={(event) => onChange({ ...value, from: event.target.value || undefined })}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 font-medium text-neutral-700">To</span>
        <input
          type="date"
          value={value.to ?? ""}
          onChange={(event) => onChange({ ...value, to: event.target.value || undefined })}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </label>
      {(value.from || value.to) && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-sm text-primary-600 hover:underline"
        >
          Reset to last 30 days
        </button>
      )}
    </div>
  );
};
