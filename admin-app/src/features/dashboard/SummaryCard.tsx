import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardHeading } from "@/components/ui/Card";

type Accent = "primary" | "accent" | "success" | "warning";

// Module-private — the four accents map to a tinted icon chip. Colors follow
// the fixed status convention (brand-kit.html §257): success = green,
// warning = amber; primary/accent are the two brand scales.
const CHIP_CLASS: Record<Accent, string> = {
  primary: "bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400",
  accent: "bg-accent-50 text-accent-600 dark:bg-accent-900/40 dark:text-accent-400",
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export interface SummaryCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: Accent;
  hint?: string;
}

export const SummaryCard = ({
  label,
  value,
  icon: Icon,
  accent = "primary",
  hint,
}: SummaryCardProps) => {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            CHIP_CLASS[accent],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <CardHeading spacing="mb-1">{label}</CardHeading>
      </div>
      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
};
