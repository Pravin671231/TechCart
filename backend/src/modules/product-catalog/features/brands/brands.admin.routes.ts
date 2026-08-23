import { Router } from "express";
import { rbac, CATALOG_ADMIN_ROLES } from "@/middleware/rbac";
import {
  createBrandHandler,
  deleteBrandHandler,
  getBrandHandler,
  listBrandsHandler,
  updateBrandHandler,
  updateBrandStatusHandler,
} from "./brands.controller";

const router = Router();
router.use(rbac(CATALOG_ADMIN_ROLES));

router.get("/", listBrandsHandler);
router.get("/:id", getBrandHandler);
router.post("/", createBrandHandler);
router.patch("/:id", updateBrandHandler);
router.patch("/:id/status", updateBrandStatusHandler);
router.delete("/:id", deleteBrandHandler);

export default router;
