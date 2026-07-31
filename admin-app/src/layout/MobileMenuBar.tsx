import { LuMenu } from "react-icons/lu";

type MobileMenuBarProps = {
  onToggleSidebar: () => void;
};

export function MobileMenuBar({ onToggleSidebar }: MobileMenuBarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center rounded-2xl border border-neutral-200 bg-white px-4 lg:hidden">
      <button
        type="button"
        aria-label="Toggle menu"
        onClick={onToggleSidebar}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
      >
        <LuMenu className="h-5 w-5" />
      </button>
    </header>
  );
}
