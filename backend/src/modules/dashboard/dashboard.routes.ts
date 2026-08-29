import { Router } from "express";
import { rbac, ORDER_ADMIN_ROLES, CATALOG_ADMIN_ROLES } from "@/middleware/rbac";
import {
  getSalesSummaryHandler,
  getSalesOverTimeHandler,
  getTopProductsHandler,
  getCatalogSummaryHandler,
} from "./dashboard.controller";

const router = Router();

// Issue #172/M7.2 — the sales routes and the catalog-summary route need
// different role allow-lists on the same mount (order-manager/super-admin
// for sales, catalog-manager/super-admin for catalog), so the guard is
// applied per-route rather than once via router.use() — same pattern
// account.routes.ts already established for an identical reason.
router.get("/summary", rbac(ORDER_ADMIN_ROLES), getSalesSummaryHandler);
router.get("/sales", rbac(ORDER_ADMIN_ROLES), getSalesOverTimeHandler);
router.get("/top-products", rbac(ORDER_ADMIN_ROLES), getTopProductsHandler);
router.get("/catalog-summary", rbac(CATALOG_ADMIN_ROLES), getCatalogSummaryHandler);

export default router;
