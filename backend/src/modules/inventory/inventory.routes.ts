import { Router } from "express";
import { rbac, CATALOG_ADMIN_ROLES } from "@/middleware/rbac";
import { listInventoryHandler, updateInventoryStockHandler } from "./inventory.controller";

const router = Router();
router.use(rbac(CATALOG_ADMIN_ROLES));

router.get("/", listInventoryHandler);
router.patch("/:inventoryId", updateInventoryStockHandler);

export default router;
