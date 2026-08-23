import categoriesAdminRoutes from "./categories.admin.routes";
import categoriesPublicRoutes from "./categories.public.routes";

// Same two-mount-point shape as brands: admin CRUD needs the rbac guard
// (mounted at categories.admin.routes.ts's own router), the public list
// must not have it (mounted directly on the root router).
export const categoriesAdminModule = {
  path: "/categories",
  router: categoriesAdminRoutes,
};

export const categoriesPublicModule = {
  path: "/api/categories",
  router: categoriesPublicRoutes,
};
