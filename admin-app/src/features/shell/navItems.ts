export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/brands", label: "Brands" },
  { to: "/specifications", label: "Specifications" },
  { to: "/variant-types", label: "Variant types" },
];
