import type { HTMLAttributes, ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-lg border bg-white dark:bg-neutral-900", {
  variants: {
    padding: {
      sm: "p-3",
      md: "p-4",
    },
    tone: {
      default: "",
      muted: "bg-neutral-50 dark:bg-neutral-800",
    },
    dashed: {
      true: "border-dashed border-neutral-300 dark:border-neutral-600",
      false: "border-neutral-200 dark:border-neutral-800",
    },
  },
  defaultVariants: {
    padding: "md",
    tone: "default",
    dashed: false,
  },
});

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md";
  tone?: "default" | "muted";
  dashed?: boolean;
  children: ReactNode;
}

export const Card = ({
  padding = "md",
  tone = "default",
  dashed = false,
  className,
  children,
  ...rest
}: CardProps) => {
  return (
    <div className={cn(cardVariants({ padding, tone, dashed }), className)} {...rest}>
      {children}
    </div>
  );
};

export interface CardHeadingProps {
  children: ReactNode;
  spacing?: "mb-1" | "mb-3" | "mb-4";
}

export const CardHeading = ({ children, spacing = "mb-3" }: CardHeadingProps) => {
  return (
    <h2
      className={cn(
        spacing,
        "text-xs font-semibold tracking-wide text-neutral-700 uppercase dark:text-neutral-200",
      )}
    >
      {children}
    </h2>
  );
};
