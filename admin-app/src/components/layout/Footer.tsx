import { LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useGetSessionQuery, useSignOutMutation } from "@/features/authentication/auth/api";
import { cn } from "@/lib/utils";

export interface FooterProps {
  onNavigate?: () => void;
  /** "rail" hides the name/label below `lg` (persistent 100px sidebar); "drawer" always shows them. */
  variant?: "rail" | "drawer";
}

export const Footer = ({ onNavigate, variant = "rail" }: FooterProps) => {
  const navigate = useNavigate();
  const [signOut] = useSignOutMutation();
  // Cached — RequireAuth has already resolved this exact session query
  // before Footer (nested inside AppShell) ever mounts, so this is a free
  // cache hit (Issue #149/M3.11).
  const { data: session } = useGetSessionQuery();
  const isRail = variant === "rail";
  const displayName = session?.name ?? "Admin User";
  const initial = displayName.charAt(0).toUpperCase() || "A";

  const handleLogout = async () => {
    await signOut();
    onNavigate?.();
    navigate("/sign-in", { replace: true });
  };

  return (
    <div className="mt-auto border-t border-neutral-200 p-2 lg:p-3">
      <div className={cn("flex items-center gap-2 rounded-md p-2", isRail && "flex-col lg:flex-row")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
          {initial}
        </span>
        <div className={cn("min-w-0 flex-1", isRail && "hidden lg:block")}>
          <Link
            to="/account"
            onClick={onNavigate}
            className="block truncate text-sm font-medium text-neutral-900 hover:text-primary-600"
          >
            {displayName}
          </Link>
        </div>
      </div>
      <button
        type="button"
        aria-label="Logout"
        onClick={handleLogout}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-neutral-200 px-2 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 lg:px-3"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={cn(isRail && "hidden lg:inline")}>Logout</span>
      </button>
    </div>
  );
};
