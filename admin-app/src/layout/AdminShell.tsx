import { Outlet } from "react-router";

export function AdminShell() {
  return (
    <div className="flex h-screen">
      <aside className="flex w-64 shrink-0 items-center justify-center border-r border-neutral-400 bg-neutral-100">
        <span className="text-sm tracking-wide text-neutral-500">Sidebar</span>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-center border-b border-neutral-400 bg-neutral-100">
          <span className="text-sm tracking-wide text-neutral-500">Header</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
