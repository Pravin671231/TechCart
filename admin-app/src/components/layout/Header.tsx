import { ShoppingCart } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export interface HeaderProps {
  compact?: boolean;
}

export const Header = ({ compact = false }: HeaderProps) => {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2">
      <ShoppingCart className="h-5 w-5 shrink-0 text-accent-600" />
      <div
        className={cn(
          "flex-col leading-tight",
          compact ? "hidden lg:flex" : "flex",
        )}
      >
        <span className="text-sm font-extrabold tracking-tight text-neutral-900">
          Tech<span className="text-primary-600">Cart</span>
        </span>
        <span className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
          Admin
        </span>
      </div>
    </Link>
  );
};
