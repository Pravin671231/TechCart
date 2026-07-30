import { LuChevronRight } from "react-icons/lu";
import { Link } from "react-router";
import type { IconType } from "react-icons";

type Breadcrumb = { label: string; to?: string };

type PageHeaderProps = {
  title: string;
  breadcrumbs: Breadcrumb[];
  action?: { label: string; icon?: IconType };
};

export function PageHeader({ title, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-800">{title}</h1>
        <nav className="mb-1 flex items-center gap-1 text-sm text-neutral-500">
          {breadcrumbs.map(({ label, to }) => (
            <span key={label} className="flex items-center gap-1">
              {to ? (
                <Link to={to} className="hover:text-neutral-700">
                  {label}
                </Link>
              ) : (
                <span>{label}</span>
              )}
              <LuChevronRight className="h-3.5 w-3.5 shrink-0" />
            </span>
          ))}
          <span className="font-semibold text-primary-800 ">{title}</span>
        </nav>
        
      </div>

      {action && (
        <button
          type="button"
          className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-hover sm:w-auto"
        >
          {action.icon ? <action.icon className="h-4 w-4" /> : null}
          {action.label}
        </button>
      )}
    </div>
  );
}
