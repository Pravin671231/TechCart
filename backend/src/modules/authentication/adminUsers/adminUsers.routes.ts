import { Router } from "express";
import { rbac } from "@/middleware/rbac";
import {
  createAdminUserHandler,
  listAdminUsersHandler,
  updateAdminUserHandler,
} from "./adminUsers.controller";

const router = Router();

// Applied once at mount, same convention every other admin route file now
// follows (Issue #143) — every route below requires a real super-admin
// session.
router.use(rbac(["super-admin"]));

router.post("/", createAdminUserHandler);
router.get("/", listAdminUsersHandler);
router.patch("/:id", updateAdminUserHandler);

export default router;
