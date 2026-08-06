import Link from "next/link";
import type { PublicCategory } from "@/features/categories/types";

export type ResolvedBreadcrumb = { current: PublicCategory; parent?: PublicCategory };

export function resolveBreadcrumb(
  categories: PublicCategory[] | undefined,
  slug: string,
): ResolvedBreadcrumb | undefined {
  if (!categories) return undefined;
  const current = categories.find((category) => category.slug === slug);
  if (!current) return undefined;
  const parent = current.parentCategory
    ? categories.find((category) => category._id === current.parentCategory)
    : undefined;
  return parent ? { current, parent } : { current };
}

export function CategoryBreadcrumb({ breadcrumb }: { breadcrumb: ResolvedBreadcrumb | undefined }) {
  return (
    <nav className="mb-4 text-sm text-neutral-500">
      <Link className="hover:text-primary-600" href="/">
        Home
      </Link>
      {breadcrumb?.parent && (
        <>
          <span className="mx-1 text-neutral-300">/</span>
          <span>{breadcrumb.parent.name}</span>
        </>
      )}
      {breadcrumb && (
        <>
          <span className="mx-1 text-neutral-300">/</span>
          <span className="font-medium text-neutral-900">{breadcrumb.current.name}</span>
        </>
      )}
    </nav>
  );
}
