import type { AccountProfile } from "@/features/authentication/account/types";
import type { OrderResponse } from "@/features/orders/types";

// Mirrors backend's AccountDashboard (account.service.ts's
// getAccountDashboard, Issue #173/M7.3).
export type AccountDashboard = {
  profile: AccountProfile;
  recentOrders: OrderResponse[];
  lifetimeOrderCount: number;
  lifetimeAmountSpent: number;
};
