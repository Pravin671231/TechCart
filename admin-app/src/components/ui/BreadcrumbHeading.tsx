import { Link } from "react-router";

export interface BreadcrumbHeadingProps {
  backTo: string;
  backLabel: string;
  current: string;
}

export const BreadcrumbHeading = ({ backTo, backLabel, current }: BreadcrumbHeadingProps) => (
  <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
    <Link to={backTo} className="text-neutral-400 hover:text-primary-600 dark:text-neutral-500">
      {backLabel}
    </Link>
    <span className="mx-1 text-neutral-300 dark:text-neutral-600">/</span>
    {current}
  </h1>
);
