import { Router } from "express";
import {
  createProductHandler,
  deleteProductHandler,
  getProductHandler,
  listProductsHandler,
  updateProductHandler,
  updateStockHandler,
  updateStatusHandler,
  addVariantHandler,
  updateVariantHandler,
} from "./products.controller";

const router = Router();

router.get("/", listProductsHandler);
router.get("/:id", getProductHandler);
router.post("/", createProductHandler);
router.patch("/:id", updateProductHandler);
router.patch("/:id/stock", updateStockHandler);
router.patch("/:id/status", updateStatusHandler);
router.delete("/:id", deleteProductHandler);
router.post("/:id/variants", addVariantHandler);
router.patch("/:id/variants/:variantId", updateVariantHandler);

export default router;
