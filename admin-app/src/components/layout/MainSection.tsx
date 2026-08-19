import { Outlet } from "react-router";

export const MainSection = () => {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <Outlet />
    </div>
  );
};
