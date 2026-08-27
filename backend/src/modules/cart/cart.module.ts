import cartRoutes from "./cart.routes";

// Single mount point — buyer-facing only, no admin surface at all (SRS v0.4
// §7: "nobody manages another person's cart"). Mounted directly on the root
// router in src/routes/index.ts, like health/brands' public list, not under
// /api/admin.
export const cartModule = {
  path: "/api/cart",
  router: cartRoutes,
};
