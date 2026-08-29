import { Router } from "express";
import { rbac } from "@/middleware/rbac";
import { ADMIN_ROLES } from "@/scripts/seed/createAdminUser";
import {
  getProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  getAccountDashboardHandler,
} from "./account.controller";

const router = Router();

// Buyer-only — mirrors every admin route file's "guard applied once, per
// route group" convention (rbac.ts), except here the two profile routes and
// the change-password route need different role allow-lists on the same
// mount, so the guard is applied per-route instead of once via router.use().
router.get("/profile", rbac(["buyer"]), getProfileHandler);
router.patch("/profile", rbac(["buyer"]), updateProfileHandler);
router.post("/change-password", rbac(ADMIN_ROLES), changePasswordHandler);
// Issue #173/M7.3 (FR-DASH-010–012) — buyer-only, mirrors the profile routes'
// guard.
router.get("/dashboard", rbac(["buyer"]), getAccountDashboardHandler);

export default router;
