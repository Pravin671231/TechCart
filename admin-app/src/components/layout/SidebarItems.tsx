import { useState } from "react";
import type { FocusEvent, MouseEvent } from "react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import type { NavItem } from "./navItems";

export interface SidebarItemsProps {
  items: NavItem[];
  onNavigate?: () => void;
  /**
   * "rail" = vertical icon-over-label, label hidden below `lg` (persistent sidebar).
   * "list" = horizontal icon+label row, label always shown (mobile drawer).
   */
  layout?: "rail" | "list";
}

interface TooltipState {
  label: string;
  top: number;
  left: number;
}

export const SidebarItems = ({ items, onNavigate, layout = "rail" }: SidebarItemsProps) => {
  const groups = Array.from(new Set(items.map((item) => item.group)));
  const isRail = layout === "rail";
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function showTooltip(label: string, event: MouseEvent | FocusEvent) {
    if (!isRail) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 8 });
  }

  function hideTooltip() {
    setTooltip(null);
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 text-sm">
      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-0.5">
          <span
            className={cn(
              "px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase",
              isRail && "hidden lg:block",
            )}
          >
            {group}
          </span>
          {items
            .filter((item) => item.group === group)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                aria-label={item.label}
                onMouseEnter={(event) => showTooltip(item.label, event)}
                onMouseLeave={hideTooltip}
                onFocus={(event) => showTooltip(item.label, event)}
                onBlur={hideTooltip}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-10 items-center gap-2 rounded-md px-3 py-2",
                    isRail &&
                      "flex-col justify-center gap-1 px-2 text-center lg:flex-row lg:justify-start lg:gap-2 lg:px-3",
                    isActive
                      ? "bg-primary-50 font-medium text-primary-700"
                      : "text-neutral-600 hover:bg-neutral-100",
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span
                  className={cn(
                    "text-sm leading-tight",
                    isRail && "hidden text-[11px] lg:block lg:text-sm",
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            ))}
        </div>
      ))}

      {isRail && tooltip && (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-y-1/2 rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-md lg:hidden"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.label}
        </span>
      )}
    </nav>
  );
};
