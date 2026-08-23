import { Router } from "express";
import { rbac, CATALOG_ADMIN_ROLES } from "@/middleware/rbac";
import {
  createCategoryHandler,
  deleteCategoryHandler,
  getCategoryHandler,
  listCategoriesHandler,
  updateCategoryHandler,
  updateCategoryStatusHandler,
} from "./categories.controller";

const router = Router();
router.use(rbac(CATALOG_ADMIN_ROLES));

router.get("/", listCategoriesHandler);
router.get("/:id", getCategoryHandler);
router.post("/", createCategoryHandler);
router.patch("/:id", updateCategoryHandler);
router.patch("/:id/status", updateCategoryStatusHandler);
router.delete("/:id", deleteCategoryHandler);

export default router;
