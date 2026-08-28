"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { useGetProfileQuery } from "./api";
import { ProfileForm } from "./ProfileForm";

export function AccountContent() {
  const router = useRouter();
  const { data: session } = useGetSessionQuery();

  useEffect(() => {
    if (session === null) {
      router.push("/sign-in");
    }
  }, [session, router]);

  const { data: profile } = useGetProfileQuery(undefined, { skip: !session });

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            My Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Update your name and phone number
          </p>
        </div>

        <div className="rounded-md border border-gray-300 p-6 flex justify-center">
          {profile ? (
            <ProfileForm profile={profile} />
          ) : (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <Link
            href="/account/addresses"
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage saved addresses
          </Link>
          <Link href="/orders" className="text-sm font-medium text-primary hover:underline">
            View your orders
          </Link>
        </div>
      </div>
    </div>
  );
}
