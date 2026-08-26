import { Navigate, Outlet } from "react-router";
import { LoadingState } from "@/components/ui/LoadingState";
import { useGetSessionQuery } from "./api";
import type { AdminRole } from "./adminRoles";
import { NoAccess } from "./NoAccess";

// Issue #149/M3.11 — this app's first per-page role guard, alongside
// RequireAuth's own deliberately coarse "any admin role passes everywhere"
// check. Nested inside RequireAuth in mainRoutes.tsx, so a valid admin
// session is already guaranteed once loaded — but useGetSessionQuery()'s
// `data` is still `undefined` on this component's very first render (RTK
// Query resolves the cache asynchronously even for an already-in-flight
// query), so `isLoading` must still be checked here too, exactly like
// RequireAuth does — without it, this guard would redirect to /sign-in on
// every render before the cached session value ever arrives.
export interface RequireRoleProps {
  role: AdminRole;
}

export const RequireRole = ({ role }: RequireRoleProps) => {
  const { data: session, isLoading } = useGetSessionQuery();

  if (isLoading) {
    return <LoadingState fullPage label="Checking your session…" />;
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  if (session.role !== role) {
    return <NoAccess />;
  }

  return <Outlet />;
};
