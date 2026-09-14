import userDirectoryRoutes from "./userDirectory.routes";

// Issue #385 — mounted under adminRouter (src/routes/admin.routes.ts) at
// /api/admin/user-directory, alongside adminUsersModule's /api/admin/users.
export const userDirectoryModule = {
  path: "/user-directory",
  router: userDirectoryRoutes,
};
