import { PRODUCT_CATALOG_ROUTES } from "@/features/product-catalog/routePaths";

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: PRODUCT_CATALOG_ROUTES.products.list, label: "Products" },
  { to: PRODUCT_CATALOG_ROUTES.categories, label: "Categories" },
  { to: PRODUCT_CATALOG_ROUTES.brands, label: "Brands" },
  { to: PRODUCT_CATALOG_ROUTES.specifications, label: "Specifications" },
  { to: PRODUCT_CATALOG_ROUTES.variantTypes, label: "Variant types" },
];
