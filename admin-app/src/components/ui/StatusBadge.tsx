import type { ReactNode } from "react";
import { cva } from "class-variance-authority";

type Tone = "success" | "neutral" | "warning";
type Shape = "pill" | "rounded";

const statusBadgeVariants = cva("px-2 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      success: "bg-green-100 text-green-700",
      neutral: "bg-neutral-100 text-neutral-600",
      warning: "bg-amber-100 text-amber-700",
    },
    shape: {
      pill: "rounded-full",
      rounded: "rounded-md",
    },
  },
  defaultVariants: {
    shape: "rounded",
  },
});

export interface StatusBadgeProps {
  tone: Tone;
  shape?: Shape;
  children: ReactNode;
  onClick?: () => void;
}

export function StatusBadge({ tone, shape = "rounded", children, onClick }: StatusBadgeProps) {
  const className = statusBadgeVariants({ tone, shape });

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    );
  }

  return <span className={className}>{children}</span>;
}
