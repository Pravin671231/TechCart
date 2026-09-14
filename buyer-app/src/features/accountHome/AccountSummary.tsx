import { ShoppingBag, Wallet } from "lucide-react";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { formatPrice } from "@/features/products/money";
import type { AccountDashboard } from "./types";

export function AccountSummary({ dashboard }: { dashboard: AccountDashboard }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-neutral-900">{dashboard.profile.name}</h3>
      <p className="text-sm text-neutral-600">{dashboard.profile.email}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
        <SummaryCard
          label="Lifetime orders"
          value={String(dashboard.lifetimeOrderCount)}
          icon={ShoppingBag}
          accent="primary"
        />
        <SummaryCard
          label="Lifetime spent"
          value={formatPrice(dashboard.lifetimeAmountSpent)}
          icon={Wallet}
          accent="accent"
        />
      </div>
    </div>
  );
}
