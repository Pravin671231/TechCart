"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { useGetAccountDashboardQuery } from "@/features/accountHome/api";
import { AccountSummary } from "@/features/accountHome/AccountSummary";
import { RecentOrdersList } from "@/features/accountHome/RecentOrdersList";
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
  // Issue #175/M7.5 — the account-home summary (profile + 5 recent orders +
  // lifetime stats) composed above the existing edit-profile section, same
  // route/session-guard as before, not a new page.
  const { data: dashboard } = useGetAccountDashboardQuery(undefined, { skip: !session });

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">My Account</h2>

        {dashboard ? (
          <>
            <AccountSummary dashboard={dashboard} />
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Recent orders</h3>
              <RecentOrdersList orders={dashboard.recentOrders} />
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-gray-500">Loading...</p>
        )}

        <div className="rounded-md border border-gray-300 p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Edit profile</h3>
          <p className="mb-4 text-sm text-gray-600">Update your name and phone number</p>
          <div className="flex justify-center">
            {profile ? (
              <ProfileForm profile={profile} />
            ) : (
              <p className="text-sm text-gray-500">Loading...</p>
            )}
          </div>
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
