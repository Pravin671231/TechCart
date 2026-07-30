import { NavLink } from "react-router";
import {
  LuFolderTree,
  LuLayoutDashboard,
  LuListChecks,
  LuPackage,
  LuSlidersHorizontal,
  LuTag,
} from "react-icons/lu";
import type { IconType } from "react-icons";

const navItems: { to: string; label: string; icon: IconType }[] = [
  { to: "/", label: "Dashboard", icon: LuLayoutDashboard },
  { to: "/products", label: "Products", icon: LuPackage },
  { to: "/categories", label: "Categories", icon: LuFolderTree },
  { to: "/brands", label: "Brands", icon: LuTag },
  { to: "/specifications", label: "Specifications", icon: LuListChecks },
  { to: "/variant-types", label: "Variant Types", icon: LuSlidersHorizontal },
];

export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-6 rounded-2xl bg-neutral-900 p-4 text-neutral-300">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
          T
        </span>
        <span className="text-lg font-semibold tracking-tight text-white">TechCart</span>
      </div>

      <nav className="flex flex-col gap-1">
        <span className="px-2 text-xs font-medium tracking-wider text-neutral-500">MAIN</span>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-600 text-white"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
