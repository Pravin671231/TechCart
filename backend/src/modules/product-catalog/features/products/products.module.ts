import productsAdminRoutes from "./products.admin.routes";
import productsPublicRoutes from "./products.public.routes";

export const productsAdminModule = {
  path: "/products",
  router: productsAdminRoutes,
};

// Same two-mount-point shape as brands/categories: admin CRUD needs the
// rbac guard (mounted at products.admin.routes.ts's own router), the public
// list/detail must not have it (mounted directly on the root router). GET /api/categories/:slug/products
// (FR-CAT-055) is the one buyer route that does NOT live under this module's
// own path prefix — see categories.public.routes.ts's import of
// listProductsByCategorySlugHandler for why.
export const productsPublicModule = {
  path: "/api/products",
  router: productsPublicRoutes,
};
