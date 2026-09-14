import type { LucideIcon } from "lucide-react";

type Accent = "primary" | "accent" | "success" | "warning";

// Module-private — mirrors admin-app's own SummaryCard (src/features/dashboard/SummaryCard.tsx)
// minus dark-mode classes, since buyer-app has no dark mode.
const CHIP_CLASS: Record<Accent, string> = {
  primary: "bg-primary-50 text-primary-600",
  accent: "bg-accent-50 text-accent-600",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
};

export interface SummaryCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: Accent;
  hint?: string;
}

export function SummaryCard({ label, value, icon: Icon, accent = "primary", hint }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${CHIP_CLASS[accent]}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium text-neutral-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
