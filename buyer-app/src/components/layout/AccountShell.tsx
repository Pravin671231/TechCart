"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { AccountSidebarNav } from "./AccountSidebarNav";

// feature/buyer-app-account-sidebar-shell — the single session guard for the
// whole account area (/account, /account/addresses, /account/profile,
// /orders, /orders/[id]), replacing the identical
// useGetSessionQuery+redirect-on-null pattern each of those content
// components used to duplicate on its own. Children can now assume an
// authenticated context and skip the guard entirely.
export function AccountShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useGetSessionQuery();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  useEffect(() => {
    if (session === null) {
      router.push(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [session, router, pathname]);

  // Close the mobile drawer on route change — adjusted during render
  // (React's documented pattern for deriving state from a prop change)
  // rather than in an effect, since react-hooks/set-state-in-effect rejects
  // the effect-based version. Same precedent as CheckoutContent's
  // default-address selection.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileNavOpen(false);
  }

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  if (!session) {
    return null;
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row lg:overflow-hidden">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 lg:hidden">
        <button
          type="button"
          aria-label="Open account menu"
          aria-expanded={mobileNavOpen}
          aria-controls="account-mobile-drawer"
          onClick={() => setMobileNavOpen(true)}
          className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          Account menu
        </button>
      </div>

      <aside className="hidden shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex lg:w-56">
        <AccountSidebarNav />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close account menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-neutral-900/40"
          />
          <aside
            id="account-mobile-drawer"
            aria-label="Account navigation"
            className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <AccountSidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="scrollbar-brand min-w-0 flex-1 lg:overflow-y-auto">{children}</div>
    </div>
  );
}
