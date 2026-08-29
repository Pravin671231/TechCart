import { formatPrice } from "@/features/products/money";
import type { AccountDashboard } from "./types";

export function AccountSummary({ dashboard }: { dashboard: AccountDashboard }) {
  return (
    <div className="rounded-md border border-gray-300 p-6">
      <h3 className="text-lg font-semibold text-gray-900">{dashboard.profile.name}</h3>
      <p className="text-sm text-gray-600">{dashboard.profile.email}</p>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
        <div>
          <p className="text-xs text-gray-500">Lifetime orders</p>
          <p className="text-xl font-semibold text-gray-900">{dashboard.lifetimeOrderCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Lifetime spent</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatPrice(dashboard.lifetimeAmountSpent)}
          </p>
        </div>
      </div>
    </div>
  );
}
