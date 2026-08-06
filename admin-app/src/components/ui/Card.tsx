import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md";
  tone?: "default" | "muted";
  dashed?: boolean;
  children: ReactNode;
}

export function Card({
  padding = "md",
  tone = "default",
  dashed = false,
  className,
  children,
  ...rest
}: CardProps) {
  const paddingClass = padding === "sm" ? "p-3" : "p-4";
  const borderClass = dashed ? "border-dashed border-neutral-300" : "border-neutral-200";
  const toneClass = tone === "muted" ? "bg-neutral-50" : "";

  return (
    <div
      className={["rounded-lg border", borderClass, paddingClass, toneClass, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeadingProps {
  children: ReactNode;
  spacing?: "mb-1" | "mb-3" | "mb-4";
}

export function CardHeading({ children, spacing = "mb-3" }: CardHeadingProps) {
  return (
    <h2 className={`${spacing} text-xs font-semibold tracking-wide text-neutral-700 uppercase`}>
      {children}
    </h2>
  );
}
