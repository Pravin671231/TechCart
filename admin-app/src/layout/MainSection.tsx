import { Outlet } from "react-router";

export function MainSection() {
  return (
    <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto rounded-2xl bg-neutral-50 p-6">
      <Outlet />
    </main>
  );
}
