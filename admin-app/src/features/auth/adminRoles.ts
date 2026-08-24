// Client-side mirror of backend's src/scripts/seed/createAdminUser.ts's
// ADMIN_ROLES — used only for RequireAuth's coarse "does this session's role
// count as an admin at all" check (Issue #148/M3.10). Per the confirmed
// scope, this app has no per-page role gating: any of these three roles
// gets in everywhere, matching admin-app's own flat, non-role-aware nav
// today.
export const ADMIN_ROLES = ["catalog-manager", "order-manager", "super-admin"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}
