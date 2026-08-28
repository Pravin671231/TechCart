import ordersRoutes from "./orders.routes";

// Buyer-facing mount point — mirrors cart's/addresses' single-mount shape.
// #158 (M5.5) adds a second, admin-only module here (mirroring brands'
// two-mount-point pattern) mounted under /api/admin/orders.
export const ordersModule = {
  path: "/api/orders",
  router: ordersRoutes,
};
