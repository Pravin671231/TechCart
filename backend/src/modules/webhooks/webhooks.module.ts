import webhooksRoutes from "./webhooks.routes";

// FR-PAY-023 — mounted ahead of routes/index.ts's global express.json()
// (same authModule precedent), since this route needs raw body access.
export const webhooksModule = {
  path: "/api/webhooks",
  router: webhooksRoutes,
};
