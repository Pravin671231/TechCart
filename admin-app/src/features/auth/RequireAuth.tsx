import { Navigate, Outlet } from "react-router";
import { LoadingState } from "@/components/ui/LoadingState";
import { useGetSessionQuery } from "./api";
import { isAdminRole } from "./adminRoles";
import { NoAccess } from "./NoAccess";

// Issue #148/M3.10 — replaces AdminKeyGate as a React Router layout route
// (rendered via <Outlet/>, not a children-wrapping component) so /sign-in
// can sit outside it as a public sibling route while everything else stays
// nested underneath (see src/routes/mainRoutes.tsx).
//
// 401 vs 403 is a client-side distinction, not two different backend status
// codes observed here: no session at all is the 401-equivalent case
// (redirect to sign-in); a real session whose role isn't one of the three
// admin roles is the 403-equivalent case (a buyer session reaching the
// admin console) — checked directly against the already-fetched session's
// own role, no extra probe request needed. Per the confirmed scope, this is
// a coarse "any admin role passes" gate — admin-app has no per-page role
// restrictions today for this to narrow further.
export const RequireAuth = () => {
  const { data: session, isLoading } = useGetSessionQuery();

  if (isLoading) {
    return <LoadingState fullPage label="Checking your session…" />;
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!isAdminRole(session.role)) {
    return <NoAccess />;
  }

  return <Outlet />;
};
