import categorySpecificationsRoutes from "./categorySpecifications.routes";

// First single-mount-point module — no public counterpart, this resource
// has zero buyer-facing surface of its own. Path has a param segment
// mid-path rather than at the end; categories.admin.routes.ts's own
// exact-match routes (e.g. "/:id") don't collide with this separately
// mounted path, so categories' files stay untouched.
export const categorySpecificationsAdminModule = {
  path: "/categories/:id/specifications",
  router: categorySpecificationsRoutes,
};
