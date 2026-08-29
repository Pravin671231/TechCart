import { Router } from "express";
import { rbac, CATALOG_ADMIN_ROLES } from "@/middleware/rbac";
import { createWarehouseHandler, listWarehousesHandler } from "./warehouses.controller";

const router = Router();
router.use(rbac(CATALOG_ADMIN_ROLES));

// FR-INV-001 — no edit/delete: a small, fixed set of 2-3 warehouses.
router.get("/", listWarehousesHandler);
router.post("/", createWarehouseHandler);

export default router;
