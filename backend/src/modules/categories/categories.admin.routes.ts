import { Router } from "express";
import {
  createCategoryHandler,
  deleteCategoryHandler,
  getCategoryHandler,
  listCategoriesHandler,
  updateCategoryHandler,
} from "./categories.controller";

const router = Router();

router.get("/", listCategoriesHandler);
router.get("/:id", getCategoryHandler);
router.post("/", createCategoryHandler);
router.patch("/:id", updateCategoryHandler);
router.delete("/:id", deleteCategoryHandler);

export default router;
