import addressesRoutes from "./addresses.routes";

// Single mount point — buyer-facing only, no admin surface (SRS v0.5 §2.1
// defines none). Mounted directly on the root router in src/routes/index.ts,
// matching cart's precedent.
export const addressesModule = {
  path: "/api/addresses",
  router: addressesRoutes,
};
