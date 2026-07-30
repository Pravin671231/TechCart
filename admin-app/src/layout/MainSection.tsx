import { Outlet } from "react-router";

export function MainSection() {
  return (
    <main className="flex-1 overflow-y-auto rounded-2xl bg-neutral-50 p-6">
      <Outlet />
    </main>
  );
}
