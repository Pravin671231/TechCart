"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";

// Routes that opt out of the global header/footer chrome (Issue #344). The
// sign-in page owns the full viewport with its own two-column layout.
const CHROMELESS_ROUTES = new Set(["/sign-in"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (CHROMELESS_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
