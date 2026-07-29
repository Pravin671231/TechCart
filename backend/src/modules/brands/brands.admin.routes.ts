import { Router } from "express";
import {
  createBrandHandler,
  deleteBrandHandler,
  getBrandHandler,
  listBrandsHandler,
  updateBrandHandler,
} from "./brands.controller";

const router = Router();

router.get("/", listBrandsHandler);
router.get("/:id", getBrandHandler);
router.post("/", createBrandHandler);
router.patch("/:id", updateBrandHandler);
router.delete("/:id", deleteBrandHandler);

export default router;
