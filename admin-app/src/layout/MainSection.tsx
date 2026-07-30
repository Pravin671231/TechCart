import { Outlet } from "react-router";

export function MainSection() {
  return (
    <main className="flex-1 overflow-y-auto">
      <Outlet />
    </main>
  );
}
