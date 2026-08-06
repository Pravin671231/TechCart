import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  size?: "lg" | "md";
  actions?: ReactNode;
}

export function PageHeader({ title, size = "lg", actions }: PageHeaderProps) {
  const headingClass =
    size === "lg"
      ? "text-2xl font-semibold tracking-tight"
      : "text-xl font-semibold tracking-tight text-neutral-900";
  const marginClass = size === "lg" ? "mb-4" : "mb-2";

  return (
    <div className={`${marginClass} flex flex-wrap items-center justify-between gap-3`}>
      <h1 className={headingClass}>{title}</h1>
      {actions}
    </div>
  );
}
