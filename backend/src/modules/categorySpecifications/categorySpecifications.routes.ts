import { Router } from "express";
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

router.get("/", getSpecificationsHandler);
router.put("/", putSpecificationsHandler);
router.patch("/", patchSpecificationsHandler);

export default router;
