import accountRoutes from "./account.routes";

// Issue #144/M3.6 — mounted directly in routes/index.ts at /api/account
// (not nested under /api/admin — its two routes have genuinely different
// role guards: buyer-only profile vs. admin-only change-password, both
// scoped to "my own account", never someone else's).
export const accountModule = {
  path: "/api/account",
  router: accountRoutes,
};
