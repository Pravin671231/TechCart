import ordersRoutes from "./orders.routes";
import ordersAdminRoutes from "./orders.admin.routes";

// Buyer-facing mount point — mirrors cart's/addresses' single-mount shape.
export const ordersModule = {
  path: "/api/orders",
  router: ordersRoutes,
};

// Admin mount point (mirrors brands'/categories'/products' two-mount-point
// shape) — mounted under adminRouter at /api/admin/orders.
export const ordersAdminModule = {
  path: "/orders",
  router: ordersAdminRoutes,
};
