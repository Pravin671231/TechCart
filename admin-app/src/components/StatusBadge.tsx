type Tone = "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, string> = {
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-700",
  neutral: "bg-neutral-200 text-neutral-600",
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${toneStyles[tone]}`}>{label}</span>
  );
}
