import { Router } from "express";
import { rbac } from "@/middleware/rbac";
import { listUserDirectoryHandler } from "./userDirectory.controller";

const router = Router();

// FR-AUTH-047 — super-admin only, same guard shape as adminUsers.routes.ts.
router.use(rbac(["super-admin"]));

router.get("/", listUserDirectoryHandler);

export default router;
