import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { Link } from "react-router";

const headerContainerVariants = cva(
  "flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between",
  {
    variants: {
      size: {
        lg: "mb-4",
        md: "mb-2",
      },
    },
    defaultVariants: {
      size: "lg",
    },
  },
);

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

export interface Breadcrumb {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  size?: "lg" | "md";
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
}

export const PageHeader = ({ title, size = "lg", actions, breadcrumbs }: PageHeaderProps) => {
  return (
    <div className={headerContainerVariants({ size })}>
      <div>
        <h1 className={headingVariants({ size })}>{title}</h1>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mt-1 text-sm text-neutral-500">
            {breadcrumbs.map((crumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1;
              return (
                <span key={`${crumb.label}-${index}`}>
                  {index > 0 && <span className="mx-1.5 text-neutral-300">&gt;</span>}
                  {isCurrent ? (
                    <span className="font-semibold text-neutral-900" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : crumb.to ? (
                    <Link to={crumb.to} className="text-neutral-500 hover:text-primary-600">
                      {crumb.label}
                    </Link>
                  ) : (
                    crumb.label
                  )}
                </span>
              );
            })}
          </nav>
        )}
      </div>
      {actions}
    </div>
  );
};
