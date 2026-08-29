import dashboardRoutes from "./dashboard.routes";

// Issue #171/M7.1 — a cross-cutting read layer over orders/payments (and,
// from #172, products/categories/brands), not a catalog-domain entity or a
// standalone collection, so it stays flat at src/modules/dashboard/ rather
// than under product-catalog/features/. Admin-only, mounted under
// /api/admin like every other admin module.
export const dashboardAdminModule = {
  path: "/dashboard",
  router: dashboardRoutes,
};
