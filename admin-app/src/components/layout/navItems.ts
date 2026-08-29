import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  ListChecks,
  Package,
  SlidersHorizontal,
  Tag,
  Users,
  Warehouse,
} from "lucide-react";
import { PRODUCT_CATALOG_ROUTES } from "@/features/product-catalog/routePaths";
import { ORDERS_ROUTES } from "@/features/orders/routePaths";
import { INVENTORY_ROUTES } from "@/features/inventory/routePaths";
import type { AdminRole } from "@/features/authentication/auth/adminRoles";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: string;
  end?: boolean;
  /** Omitted = visible to every admin role. Present = only visible once the signed-in session's role is included (Issue #149/M3.11). */
  roles?: AdminRole[];
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
  {
    to: ORDERS_ROUTES.list,
    label: "Orders",
    icon: ClipboardList,
    group: "Orders",
    roles: ["order-manager", "super-admin"],
  },
  {
    to: INVENTORY_ROUTES.inventory,
    label: "Inventory",
    icon: Boxes,
    group: "Inventory",
    roles: ["catalog-manager", "super-admin"],
  },
  {
    to: INVENTORY_ROUTES.warehouses,
    label: "Warehouses",
    icon: Warehouse,
    group: "Inventory",
    roles: ["catalog-manager", "super-admin"],
  },
  {
    to: "/admin-users",
    label: "Admin Users",
    icon: Users,
    group: "Administration",
    roles: ["super-admin"],
  },
];
