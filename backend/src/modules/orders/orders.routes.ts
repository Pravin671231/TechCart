import { Router } from "express";
import { rbac } from "@/middleware/rbac";
import { checkoutHandler } from "./orders.controller";

const router = Router();

// FR-ORD-001 — checkout requires an authenticated buyer session; unavailable
// to guests even though building a cart is not (FR-CART-004). #157 adds
// GET / and GET /:id and POST /:id/cancel to this same router.
router.use(rbac(["buyer"]));

router.post("/", checkoutHandler);

export default router;
