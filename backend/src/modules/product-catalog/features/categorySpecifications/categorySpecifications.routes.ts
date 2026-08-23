import { Router } from "express";
import { rbac, CATALOG_ADMIN_ROLES } from "@/middleware/rbac";
import {
  getSpecificationsHandler,
  putSpecificationsHandler,
  patchSpecificationsHandler,
} from "./categorySpecifications.controller";

// mergeParams: true is required — this router is mounted mid-path at
// "/categories/:id/specifications" (see categorySpecifications.module.ts),
// and Express routers don't inherit parent path params by default. Without
// it, req.params.id would be undefined on every request here.
const router = Router({ mergeParams: true });
router.use(rbac(CATALOG_ADMIN_ROLES));

router.get("/", getSpecificationsHandler);
router.put("/", putSpecificationsHandler);
router.patch("/", patchSpecificationsHandler);

export default router;
