import { Router } from "express";
import { rbac } from "@/middleware/rbac";
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

export default router;
