import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useLocation } from "react-router";
import { Header } from "./Header";
import { MainSection } from "./MainSection";
import { Sidebar } from "./Sidebar";

export const AppShell = () => {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 md:hidden">
        <Header />
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav-drawer"
          onClick={() => setMobileNavOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <aside className="hidden w-20 lg:w-50 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
        <Sidebar variant="rail" />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-neutral-900/40"
          />
          <aside
            id="mobile-nav-drawer"
            aria-label="Navigation"
            className="relative flex h-full w-64 max-w-[80vw] flex-col bg-white shadow-xl"
          >
            <Sidebar variant="drawer" onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <MainSection />
    </div>
  );
};
