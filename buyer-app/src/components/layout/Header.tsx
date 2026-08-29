"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { CartIndicator } from "./CartIndicator";
import { CategoriesMenu } from "./CategoriesMenu";
import { Logo } from "./Logo";
import { ProfileMenu } from "./ProfileMenu";
import { SearchBar } from "./SearchBar";

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    function handlePointer(event: MouseEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setSearchOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSearchOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [searchOpen]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4">
        <Link href="/" aria-label="TechCart home" className="flex shrink-0">
          <Logo />
        </Link>

        {/* Desktop: inline categories + search bar */}
        <div className="hidden h-10 flex-1 items-stretch rounded-md border border-neutral-300 bg-white focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600 md:flex">
          <CategoriesMenu />
          <SearchBar />
        </div>

        {/* Mobile: collapsed search trigger */}
        <button
          type="button"
          aria-label="Toggle search bar"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((value) => !value)}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 md:hidden"
        >
          <Search size={20} aria-hidden="true" />
        </button>

        <CartIndicator />
        <ProfileMenu />
      </div>

      {/* Mobile: collapsible search panel */}
      {searchOpen && (
        <div className="border-t border-neutral-200 px-4 py-2 md:hidden">
          <div className="flex h-10 items-stretch rounded-md border border-neutral-300 bg-white focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600">
            <CategoriesMenu />
            <SearchBar />
          </div>
        </div>
      )}
    </header>
  );
}
