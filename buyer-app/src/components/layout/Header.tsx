import Link from "next/link";
import { CartIndicator } from "./CartIndicator";
import { CategoriesMenu } from "./CategoriesMenu";
import { Logo } from "./Logo";
import { ProfileMenu } from "./ProfileMenu";
import { SearchBar } from "./SearchBar";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" aria-label="TechCart home" className="flex shrink-0">
          <Logo />
        </Link>

        <div className="flex h-10 flex-1 items-stretch rounded-md border border-neutral-300 bg-white focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600">
          <CategoriesMenu />
          <SearchBar />
        </div>

        <CartIndicator />
        <ProfileMenu />
      </div>
    </header>
  );
}
