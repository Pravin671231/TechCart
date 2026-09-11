import { Outlet } from "react-router";

export const MainSection = () => {
  return (
    <div className="scrollbar-brand flex min-w-0 flex-1 flex-col overflow-y-auto bg-white dark:bg-neutral-950">
      <Outlet />
    </div>
  );
};
