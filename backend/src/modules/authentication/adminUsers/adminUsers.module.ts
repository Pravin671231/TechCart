import adminUsersRoutes from "./adminUsers.routes";

// Issue #142/M3.4 — mounted under adminRouter (src/routes/admin.routes.ts)
// at /api/admin/users. Admin-only, no public counterpart, matching
// categorySpecifications/categoryVariants' single-mount-point shape.
export const adminUsersModule = {
  path: "/users",
  router: adminUsersRoutes,
};
