import { cn } from "@/lib/utils";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { isAdminRole } from "@/features/authentication/auth/adminRoles";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { NAV_ITEMS } from "./navItems";
import { SidebarItems } from "./SidebarItems";

export interface SidebarProps {
  onNavigate?: () => void;
  /**
   * "rail" = persistent 100px sidebar (tablet: icon-only, desktop: icon+label).
   * "drawer" = mobile slide-over, always shows full labels regardless of viewport width.
   */
  variant?: "rail" | "drawer";
}

export const Sidebar = ({ onNavigate, variant = "rail" }: SidebarProps) => {
  const isRail = variant === "rail";
  // Cached by RTK Query — RequireAuth has already resolved this exact
  // session query before Sidebar (nested inside AppShell) ever mounts, so
  // this is a free cache hit, not a new request or a loading flicker
  // (Issue #149/M3.11). Role-gated items (e.g. "Admin Users") only render
  // once the session's role is confirmed to include them, so they never
  // flash for the wrong role even momentarily; items with no `roles` at
  // all always render regardless of session load state.
  const { data: session } = useGetSessionQuery();
  const role = session?.role;
  const items = NAV_ITEMS.filter(
    (item) => !item.roles || (role !== undefined && isAdminRole(role) && item.roles.includes(role)),
  );

  return (
    <>
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-neutral-200",
          isRail ? "justify-center px-2 lg:justify-start lg:px-4" : "justify-start px-4",
        )}
      >
        <Header compact={isRail} />
      </div>
      <SidebarItems items={items} onNavigate={onNavigate} layout={isRail ? "rail" : "list"} />
      <Footer onNavigate={onNavigate} variant={variant} />
    </>
  );
};
