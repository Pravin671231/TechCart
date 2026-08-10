import type { ReactNode } from "react";
import { cva } from "class-variance-authority";

const headerContainerVariants = cva("flex flex-wrap items-center justify-between gap-3", {
  variants: {
    size: {
      lg: "mb-4",
      md: "mb-2",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

const headingVariants = cva("font-semibold tracking-tight", {
  variants: {
    size: {
      lg: "text-2xl",
      md: "text-xl text-neutral-900",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

export interface PageHeaderProps {
  title: ReactNode;
  size?: "lg" | "md";
  actions?: ReactNode;
}

export const PageHeader = ({ title, size = "lg", actions }: PageHeaderProps) => {
  return (
    <div className={headerContainerVariants({ size })}>
      <h1 className={headingVariants({ size })}>{title}</h1>
      {actions}
    </div>
  );
};
