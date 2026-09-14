"use client";

import { useGetAccountDashboardQuery } from "@/features/accountHome/api";
import { AccountSummary } from "@/features/accountHome/AccountSummary";
import { AccountCtaBanner } from "@/features/accountHome/AccountCtaBanner";
import { RecentOrdersList } from "@/features/accountHome/RecentOrdersList";

// feature/buyer-app-account-sidebar-shell — the "Overview" sidebar panel.
// AccountShell already guarantees an authenticated session before this
// renders, so no session guard or `skip` here (previously duplicated in
// every account-area content component). Edit-profile and cross-navigation
// links moved out to their own sidebar destinations (ProfileContent, the
// Orders/Addresses nav items) — see ProfileContent.tsx.
export function AccountContent() {
  const { data: dashboard } = useGetAccountDashboardQuery();

  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-neutral-900">
          My Account
        </h2>

        {dashboard ? (
          <>
            <AccountSummary dashboard={dashboard} />
            <AccountCtaBanner
              title="Track your orders"
              subtitle="See status, invoices and delivery updates."
              ctaLabel="View all orders"
              href="/orders"
            />
            <div>
              <h3 className="mb-3 text-lg font-semibold text-neutral-900">Recent orders</h3>
              <RecentOrdersList orders={dashboard.recentOrders} />
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-neutral-500">Loading...</p>
        )}
      </div>
    </div>
  );
}
