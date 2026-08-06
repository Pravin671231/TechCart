import type { ReactNode } from "react";

type Tone = "success" | "neutral" | "warning";
type Shape = "pill" | "rounded";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-green-100 text-green-700",
  neutral: "bg-neutral-100 text-neutral-600",
  warning: "bg-amber-100 text-amber-700",
};

export interface StatusBadgeProps {
  tone: Tone;
  shape?: Shape;
  children: ReactNode;
  onClick?: () => void;
}

export function StatusBadge({ tone, shape = "rounded", children, onClick }: StatusBadgeProps) {
  const className = `${shape === "pill" ? "rounded-full" : "rounded-md"} px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    );
  }

  return <span className={className}>{children}</span>;
}
