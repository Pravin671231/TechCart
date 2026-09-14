import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, MapPin, ShoppingBag, User } from "lucide-react";

export interface AccountNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** true = active only on an exact pathname match; false = active on any pathname prefix match too. */
  exact: boolean;
}

export const ACCOUNT_NAV_ITEMS: AccountNavItem[] = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/orders", label: "Orders", icon: ShoppingBag, exact: false },
  { href: "/account/addresses", label: "Addresses", icon: MapPin, exact: true },
  { href: "/account/profile", label: "Profile", icon: User, exact: true },
];
