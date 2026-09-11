import { cn } from "@/lib/utils";
import { CardHeading } from "@/components/ui/Card";

export type BreakdownTone = "primary" | "accent" | "success" | "neutral" | "warning";

export interface BreakdownSegment {
  label: string;
  value: number;
  tone: BreakdownTone;
}

export interface StatusBreakdownProps {
  title: string;
  total: number;
  segments: BreakdownSegment[];
}

// Module-private — the progress-bar fill color per tone. Mirrors the fixed
// status convention (green/amber) plus the two brand scales; neutral is the
// grey used for "not yet actioned" states.
const FILL_CLASS: Record<BreakdownTone, string> = {
  primary: "bg-primary-500",
  accent: "bg-accent-500",
  success: "bg-green-500",
  neutral: "bg-neutral-400",
  warning: "bg-amber-500",
};

export const StatusBreakdown = ({ title, total, segments }: StatusBreakdownProps) => {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <CardHeading>{title}</CardHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {segments.map((segment) => {
          const percent = total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <div key={segment.label} className="rounded-lg border border-neutral-200 p-3">
              <p className="text-[11px] text-neutral-500">{segment.label}</p>
              <p className="text-lg font-bold text-neutral-900">{segment.value}</p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-neutral-100">
                <div
                  className={cn("h-1.5 rounded-full", FILL_CLASS[segment.tone])}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">{percent}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
