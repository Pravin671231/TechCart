import { Router } from "express";
import { ORDER_ADMIN_ROLES, rbac } from "@/middleware/rbac";
import { refundOrderHandler } from "@/modules/payments/payments.controller";
import {
  adminCancelOrderHandler,
  advanceOrderStatusHandler,
  getAdminOrderHandler,
  listAdminOrdersHandler,
} from "./orders.controller";

const router = Router();

// FR-ORD-017-020 — order-manager/super-admin only; a catalog-manager
// session is rejected 403 on every route in this router, the reciprocal of
// the boundary v0.3 drew around catalog routes (FR-AUTH-025).
router.use(rbac(ORDER_ADMIN_ROLES));

router.get("/", listAdminOrdersHandler);
router.get("/:id", getAdminOrderHandler);
router.patch("/:id/status", advanceOrderStatusHandler);
router.post("/:id/cancel", adminCancelOrderHandler);
// FR-PAY-012-018 — admin-initiated refund, owned by the payments module.
router.post("/:id/refund", refundOrderHandler);

export default router;
