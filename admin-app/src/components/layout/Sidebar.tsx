import { cn } from "@/lib/utils";
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
      <SidebarItems items={NAV_ITEMS} onNavigate={onNavigate} layout={isRail ? "rail" : "list"} />
      <Footer onNavigate={onNavigate} variant={variant} />
    </>
  );
};
