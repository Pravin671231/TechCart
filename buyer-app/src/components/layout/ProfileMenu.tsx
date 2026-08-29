"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { useGetSessionQuery, useSignOutMutation } from "@/features/authentication/auth/api";
import type { SessionUser } from "@/features/authentication/auth/types";

function ProfileIcon() {
  return (
    <div className="flex items-center justify-center rounded-full border border-neutral-300 bg-gray-100 p-1 ">
      <User className="h-5 w-5" aria-hidden="true" />
    </div>
  );
}

// Issue #322 — the first two letters of the user's name (email local-part
// when there's no name), uppercased. "John Doe" → "JO", "John" → "JO".
function initialsFor(session: SessionUser): string {
  const source = session.name?.trim() || session.email.split("@")[0] || "";
  return source.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "U";
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
      {initials}
    </span>
  );
}

export function ProfileMenu() {
  const { data: session } = useGetSessionQuery();
  const [signOut] = useSignOutMutation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Loading — match AuthStatus's previous guard (render nothing until known).
  if (session === undefined) {
    return null;
  }

  if (!session) {
    return (
      <Link href="/sign-in" aria-label="Sign in" className="flex cursor-pointer text-gray-700 hover:text-gray-900">
        <ProfileIcon />
      </Link>
    ); 
  }

  const initials = initialsFor(session);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut().catch(() => {
      // error is handled by the mutation
    });
    router.push("/");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-600"
      >
        <Avatar initials={initials} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
            <Avatar initials={initials} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-800">{session.name}</p>
              <p className="truncate text-xs text-neutral-500">{session.email}</p>
            </div>
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Account
          </Link>
          <Link
            href="/orders"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Orders
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="block w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
