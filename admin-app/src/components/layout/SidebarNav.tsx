import { NavLink } from "react-router";
import { useAppDispatch } from "@/app/store/hooks";
import { clearAdminKey } from "@/app/store/authSlice";
import { NAV_ITEMS } from "./navItems";

export const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => {
  const dispatch = useAppDispatch();

  return (
    <>
      <NavLink
        to="/"
        end
        onClick={onNavigate}
        className="flex h-16 shrink-0 items-center gap-2 border-b border-neutral-200 px-4"
      >
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold tracking-tight text-neutral-900">
            Tech<span className="text-primary-600">Cart</span>
          </span>
          <span className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
            Admin
          </span>
        </div>
      </NavLink>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 text-sm">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 ${
                isActive
                  ? "bg-primary-50 font-medium text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-neutral-200 p-3">
        <div className="flex items-center gap-2 rounded-md p-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
            A
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900">Admin User</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            dispatch(clearAdminKey());
            onNavigate?.();
          }}
          className="mt-2 flex w-full items-center justify-center rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          Logout
        </button>
      </div>
    </>
  );
};
