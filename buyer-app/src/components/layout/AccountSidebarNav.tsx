"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_NAV_ITEMS } from "./accountNavItems";

function isItemActive(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="scrollbar-brand flex flex-1 flex-col gap-1 overflow-y-auto p-3 text-sm">
      {ACCOUNT_NAV_ITEMS.map((item) => {
        const active = isItemActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 font-medium ${
              active
                ? "bg-primary-50 text-primary-700"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
