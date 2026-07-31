import { Router } from "express";
import {
  createProductHandler,
  deleteProductHandler,
  getProductHandler,
  listProductsHandler,
  updateProductHandler,
  updateStockHandler,
} from "./products.controller";

const router = Router();

router.get("/", listProductsHandler);
router.get("/:id", getProductHandler);
router.post("/", createProductHandler);
router.patch("/:id", updateProductHandler);
router.patch("/:id/stock", updateStockHandler);
router.delete("/:id", deleteProductHandler);

export default router;
