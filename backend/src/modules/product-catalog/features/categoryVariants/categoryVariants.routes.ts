import { Router } from "express";
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

router.get("/", getVariantAxesHandler);
router.put("/", putVariantAxesHandler);
router.patch("/", patchVariantAxesHandler);

export default router;
