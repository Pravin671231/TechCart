import { Router } from "express";
import { rbac, ORDER_ADMIN_ROLES } from "@/middleware/rbac";
import {
  getSalesSummaryHandler,
  getSalesOverTimeHandler,
  getTopProductsHandler,
} from "./dashboard.controller";

const router = Router();
router.use(rbac(ORDER_ADMIN_ROLES));

router.get("/summary", getSalesSummaryHandler);
router.get("/sales", getSalesOverTimeHandler);
router.get("/top-products", getTopProductsHandler);

export default router;
