import { Router } from "express";
import { rbac, CATALOG_ADMIN_ROLES } from "@/middleware/rbac";
import {
  getVariantAxesHandler,
  putVariantAxesHandler,
  patchVariantAxesHandler,
} from "./categoryVariants.controller";

// mergeParams: true is required — this router is mounted mid-path at
// "/categories/:id/variant-types" (see categoryVariants.module.ts), same
// requirement as categorySpecifications.routes.ts. Without it, req.params.id
// would be undefined on every request here.
const router = Router({ mergeParams: true });
router.use(rbac(CATALOG_ADMIN_ROLES));

router.get("/", getVariantAxesHandler);
router.put("/", putVariantAxesHandler);
router.patch("/", patchVariantAxesHandler);

export default router;
