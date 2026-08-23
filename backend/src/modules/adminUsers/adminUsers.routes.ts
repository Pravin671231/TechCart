import { Router } from "express";
import { requireRole } from "@/middleware/requireRole";
import {
  createAdminUserHandler,
  listAdminUsersHandler,
  updateAdminUserHandler,
} from "./adminUsers.controller";

const router = Router();

// Applied once at mount, same convention adminAuth.ts already established
// for the router-level guard — every route below requires a real
// super-admin session, layered on top of adminRouter's own X-Admin-Key
// check (src/routes/admin.routes.ts).
router.use(requireRole("super-admin"));

router.post("/", createAdminUserHandler);
router.get("/", listAdminUsersHandler);
router.patch("/:id", updateAdminUserHandler);

export default router;
