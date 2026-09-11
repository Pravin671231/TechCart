import { cn } from "@/lib/utils";
import type { DateRangeParams } from "./types";

export interface DateRangePickerProps {
  value: DateRangeParams;
  onChange: (next: DateRangeParams) => void;
}

// An empty {from, to} deliberately means "let the backend decide" — its own
// resolveDateRange() defaults to the last 30 days. The preset buttons are
// explicit user choices that DO pre-compute dates; "Reset" clears back to
// the empty (backend-default) state.
const PRESETS: { label: string; days: number }[] = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function presetRange(days: number): DateRangeParams {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export const DateRangePicker = ({ value, onChange }: DateRangePickerProps) => {
  const hasCustom = Boolean(value.from || value.to);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => {
        const range = presetRange(preset.days);
        const active = value.from === range.from && value.to === range.to;
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(range)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              active
                ? "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-900/40 dark:text-primary-300"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800",
            )}
          >
            {preset.label}
          </button>
        );
      })}

      <label className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        From
        <input
          type="date"
          value={value.from ?? ""}
          onChange={(event) => onChange({ ...value, from: event.target.value || undefined })}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </label>
      <label className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        To
        <input
          type="date"
          value={value.to ?? ""}
          onChange={(event) => onChange({ ...value, to: event.target.value || undefined })}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </label>

      {hasCustom && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-xs text-primary-600 hover:underline dark:text-primary-400"
        >
          Reset
        </button>
      )}
    </div>
  );
};
