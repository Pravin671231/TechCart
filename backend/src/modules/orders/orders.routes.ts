import { Router } from "express";
import { rbac } from "@/middleware/rbac";
import { initiatePaymentHandler, verifyPaymentHandler } from "@/modules/payments/payments.controller";
import {
  cancelOrderHandler,
  checkoutHandler,
  getOrderHandler,
  listOrdersHandler,
} from "./orders.controller";

const router = Router();

// FR-ORD-001, FR-ORD-011-014 — every buyer-facing order endpoint requires an
// authenticated buyer session; unavailable to guests even though building a
// cart is not (FR-CART-004).
router.use(rbac(["buyer"]));

router.post("/", checkoutHandler);
router.get("/", listOrdersHandler);
router.get("/:id", getOrderHandler);
router.post("/:id/cancel", cancelOrderHandler);
// FR-PAY-001-011 — payment initiation and client-side verification. Owned
// by the payments module (src/modules/payments/), routed here since both
// paths are order-scoped and this router already carries the buyer/order
// ownership guard these two need identically.
router.post("/:id/payment", initiatePaymentHandler);
router.post("/:id/payment/verify", verifyPaymentHandler);

export default router;
