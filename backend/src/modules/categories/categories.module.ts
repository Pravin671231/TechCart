import categoriesAdminRoutes from "./categories.admin.routes";
import categoriesPublicRoutes from "./categories.public.routes";

// Same two-mount-point shape as brands: admin CRUD needs the adminAuth
// guard (mounted under adminRouter), the public list must not have it
// (mounted directly on the root router).
export const categoriesAdminModule = {
  path: "/categories",
  router: categoriesAdminRoutes,
};

export const categoriesPublicModule = {
  path: "/api/categories",
  router: categoriesPublicRoutes,
};
