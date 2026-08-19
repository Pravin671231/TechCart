import type { LucideIcon } from "lucide-react";
import { FolderTree, LayoutDashboard, ListChecks, Package, SlidersHorizontal, Tag } from "lucide-react";
import { PRODUCT_CATALOG_ROUTES } from "@/features/product-catalog/routePaths";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: string;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "Overview", end: true },
  {
    to: PRODUCT_CATALOG_ROUTES.products.list,
    label: "Products",
    icon: Package,
    group: "Catalog",
  },
  {
    to: PRODUCT_CATALOG_ROUTES.categories,
    label: "Categories",
    icon: FolderTree,
    group: "Catalog",
  },
  { to: PRODUCT_CATALOG_ROUTES.brands, label: "Brands", icon: Tag, group: "Catalog" },
  {
    to: PRODUCT_CATALOG_ROUTES.specifications,
    label: "Specifications",
    icon: ListChecks,
    group: "Catalog",
  },
  {
    to: PRODUCT_CATALOG_ROUTES.variantTypes,
    label: "Variant types",
    icon: SlidersHorizontal,
    group: "Catalog",
  },
];
