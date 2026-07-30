import { LuBell, LuMaximize, LuMenu, LuMoon, LuSearch } from "react-icons/lu";

type HeaderProps = {
  onToggleSidebar: () => void;
};

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-4">
      <div className="flex flex-1 items-center gap-4">
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 lg:hidden"
        >
          <LuMenu className="h-5 w-5" />
        </button>

        <label className="flex w-full max-w-sm items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-500">
          <LuSearch className="h-4 w-4 shrink-0" />
          <input
            type="search"
            placeholder="Search anything..."
            className="w-full bg-transparent outline-none placeholder:text-neutral-400"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Toggle theme"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
        >
          <LuMoon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Toggle fullscreen"
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 sm:flex"
        >
          <LuMaximize className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
        >
          <LuBell className="h-4 w-4" />
        </button>

        <div className="ml-2 flex items-center gap-2 border-l border-neutral-200 pl-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
            A
          </span>
          <div className="hidden text-sm leading-tight sm:block">
            <p className="font-semibold text-neutral-800">Admin</p>
            <p className="text-neutral-500">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
