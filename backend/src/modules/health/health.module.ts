import healthRoutes from "./health.routes";

export const healthModule = {
  path: "/health",
  router: healthRoutes,
};
