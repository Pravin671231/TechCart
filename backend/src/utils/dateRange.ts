import { AppError } from "@/utils/AppError";

export type DateRange = { from: Date; to: Date };

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000; // FR-DASH-019 — just over a year to tolerate leap years
const DAY_BUCKET_THRESHOLD_DAYS = 31;

// FR-DASH-002/019 — ?from=&to= (ISO date strings). Both omitted defaults to
// the last 30 days; a reversed range or one spanning more than a year is
// rejected outright, never clamped.
export function resolveDateRange(from?: string, to?: string): DateRange {
  if (!from && !to) {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from: fromDate, to: toDate };
  }

  const fromDate = from ? new Date(from) : new Date(0);
  const toDate = to ? new Date(to) : new Date();

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new AppError(400, "INVALID_DATE_RANGE", "from/to must be valid dates.");
  }

  if (toDate.getTime() < fromDate.getTime()) {
    throw new AppError(400, "INVALID_DATE_RANGE", "to must not be before from.");
  }

  if (toDate.getTime() - fromDate.getTime() > MAX_RANGE_MS) {
    throw new AppError(400, "RANGE_TOO_LARGE", "Date range must not exceed one year.");
  }

  return { from: fromDate, to: toDate };
}

export type SalesBucket = "day" | "week";

// FR-DASH-005 — day-bucketed for a range of 31 days or less, week-bucketed
// for anything longer.
export function resolveBucket(range: DateRange): SalesBucket {
  const days = (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
  return days <= DAY_BUCKET_THRESHOLD_DAYS ? "day" : "week";
}

export function toIsoRange(range: DateRange): { from: string; to: string } {
  return { from: range.from.toISOString(), to: range.to.toISOString() };
}

function isoWeekKey(date: Date): string {
  // ISO 8601 week — matches MongoDB's $dateToString "%G-W%V" format exactly,
  // so a bucket key computed here always lines up with one aggregated in
  // orders.repository.ts's salesOverTimeInRange.
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // nearest Thursday
  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 4));
  const weekNumber = 1 + Math.round(((target.getTime() - yearStart.getTime()) / 86400000 - 3) / 7);
  return `${isoYear}-W${String(weekNumber).padStart(2, "0")}`;
}

// FR-DASH-018 — every bucket between from/to gets a key, even ones with no
// matching orders, so the service layer can zero-fill gaps the repository's
// own aggregation (which only emits rows for buckets that actually matched)
// otherwise omits entirely.
export function generateBucketKeys(range: DateRange, bucket: SalesBucket): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const cursor = new Date(range.from);
  const stepMs = bucket === "day" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  while (cursor.getTime() <= range.to.getTime()) {
    const key = bucket === "day" ? (cursor.toISOString().split("T")[0] ?? "") : isoWeekKey(cursor);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    cursor.setTime(cursor.getTime() + stepMs);
  }

  return keys;
}
