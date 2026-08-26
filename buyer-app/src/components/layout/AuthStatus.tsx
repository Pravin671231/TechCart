"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGetSessionQuery, useSignOutMutation } from "@/features/authentication/auth/api";

export function AuthStatus() {
  const { data: session } = useGetSessionQuery();
  const [signOut] = useSignOutMutation();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut().catch(() => {
      // error is handled by mutation
    });
    router.push("/");
  };

  if (session === undefined) {
    return null;
  }

  if (!session) {
    return (
      <Link href="/sign-in" className="text-gray-700 hover:text-gray-900 font-medium">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/account" className="text-gray-700 hover:text-gray-900 font-medium">
        {session.name}
      </Link>
      <button
        onClick={handleSignOut}
        className="text-gray-700 hover:text-gray-900 font-medium"
      >
        Sign out
      </button>
    </div>
  );
}
