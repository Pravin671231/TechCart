import { LoadingState } from "@/components/ui/LoadingState";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { CatalogDashboard } from "./CatalogDashboard";
import { SalesDashboard } from "./SalesDashboard";

const SALES_ROLES = ["order-manager", "super-admin"];

// Issue #174/M7.4 — replaces LandingPlaceholder at "/". Every admin role
// still lands here (mainRoutes.tsx's "/" route stays role-unrestricted),
// but the content branches by the signed-in role via useGetSessionQuery()
// (the same cached-session-read pattern Footer.tsx/Sidebar.tsx already use)
// rather than a route-level split — a catalog-manager never renders the
// sales/revenue widgets, matching the backend's own role-exclusive
// endpoints exactly.
export const DashboardPage = () => {
  const { data: session, isLoading } = useGetSessionQuery();

  if (isLoading) {
    return <LoadingState fullPage label="Loading dashboard…" />;
  }

  if (session && SALES_ROLES.includes(session.role)) {
    return <SalesDashboard />;
  }

  return <CatalogDashboard />;
};
