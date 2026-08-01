import brandsAdminRoutes from "./brands.admin.routes";
import brandsPublicRoutes from "./brands.public.routes";

// Two mount points, unlike every other module so far: admin CRUD needs the
// adminAuth guard (mounted under adminRouter), the public list must not have
// it (mounted directly on the root router). See brands.admin.routes.ts /
// brands.public.routes.ts.
export const brandsAdminModule = {
  path: "/brands",
  router: brandsAdminRoutes,
};

export const brandsPublicModule = {
  path: "/api/brands",
  router: brandsPublicRoutes,
};
