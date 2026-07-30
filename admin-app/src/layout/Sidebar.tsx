import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import {
  LuChevronDown,
  LuFolderTree,
  LuLayers,
  LuLayoutDashboard,
  LuListChecks,
  LuPackage,
  LuSlidersHorizontal,
  LuTag,
} from "react-icons/lu";
import type { IconType } from "react-icons";

const productCatalogItems: { to: string; label: string; icon: IconType }[] = [
  { to: "/product-catalog/products", label: "Products", icon: LuPackage },
  { to: "/product-catalog/categories", label: "Categories", icon: LuFolderTree },
  { to: "/product-catalog/brands", label: "Brands", icon: LuTag },
  { to: "/product-catalog/specifications", label: "Specifications", icon: LuListChecks },
  { to: "/product-catalog/variant-types", label: "Variant Types", icon: LuSlidersHorizontal },
];

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-primary-600 text-white"
      : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
  }`;

export function Sidebar() {
  const location = useLocation();
  const isProductCatalogActive = location.pathname.startsWith("/product-catalog");
  const [isProductCatalogOpen, setIsProductCatalogOpen] = useState(isProductCatalogActive);

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 rounded-2xl bg-neutral-900 p-4 text-neutral-300">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
          T
        </span>
        <span className="text-lg font-semibold tracking-tight text-white">TechCart</span>
      </div>

      <nav className="flex flex-col gap-1">
        <span className="px-2 text-xs font-medium tracking-wider text-neutral-500">MAIN</span>

        <NavLink to="/" end className={navLinkClassName}>
          <LuLayoutDashboard className="h-4 w-4 shrink-0" />
          Dashboard
        </NavLink>

        <button
          type="button"
          aria-expanded={isProductCatalogOpen}
          onClick={() => setIsProductCatalogOpen((open) => !open)}
          className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isProductCatalogActive
              ? "bg-primary-600 text-white"
              : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
          }`}
        >
          <span className="flex items-center gap-3">
            <LuLayers className="h-4 w-4 shrink-0" />
            Product Catalog
          </span>
          <LuChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${isProductCatalogOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isProductCatalogOpen && (
          <div className="ml-4 flex flex-col gap-1 border-l border-neutral-800 pl-3">
            {productCatalogItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={navLinkClassName}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}
