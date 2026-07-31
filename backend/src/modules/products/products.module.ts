import productsAdminRoutes from "./products.admin.routes";

// Admin-only for now, same naming shape as brands'/categories' admin module
// (a products.public.routes.ts + productsPublicModule land in #35, buyer
// browsing — GET /api/products / GET /api/products/:slug aren't this
// issue's scope).
export const productsAdminModule = {
  path: "/products",
  router: productsAdminRoutes,
};
