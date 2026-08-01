import categoryVariantsRoutes from "./categoryVariants.routes";

// Single-mount-point module, no public counterpart — same shape as
// categorySpecificationsAdminModule. Path is "/categories/:id/variant-types"
// per the SRS endpoint table (FR-CAT-036/037); categories.admin.routes.ts's
// own exact-match routes don't collide with this separately mounted path.
export const categoryVariantsAdminModule = {
  path: "/categories/:id/variant-types",
  router: categoryVariantsRoutes,
};
