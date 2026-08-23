import { Router } from "express";
import { rbac, CATALOG_ADMIN_ROLES } from "@/middleware/rbac";
import {
  createProductHandler,
  deleteProductHandler,
  getProductHandler,
  listProductsHandler,
  updateProductHandler,
  updateStatusHandler,
  addVariantHandler,
  updateVariantHandler,
} from "./products.controller";

const router = Router();
router.use(rbac(CATALOG_ADMIN_ROLES));

router.get("/", listProductsHandler);
router.get("/:id", getProductHandler);
router.post("/", createProductHandler);
router.patch("/:id", updateProductHandler);
router.patch("/:id/status", updateStatusHandler);
router.delete("/:id", deleteProductHandler);
router.post("/:id/variants", addVariantHandler);
router.patch("/:id/variants/:variantId", updateVariantHandler);

export default router;
