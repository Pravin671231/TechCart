import { Router } from "express";
import { rbac } from "@/middleware/rbac";
import {
  addItemHandler,
  clearCartHandler,
  getCartHandler,
  removeItemHandler,
  updateItemHandler,
} from "./cart.controller";

const router = Router();

// FR-CART-002 — every cart endpoint requires an authenticated buyer session;
// an unauthenticated request is rejected (401 UNAUTHENTICATED), never treated
// as an anonymous/guest cart. Applied once at the router's top, the same
// "guard per route group" convention every catalog admin route uses.
router.use(rbac(["buyer"]));

router.get("/", getCartHandler);
router.post("/items", addItemHandler);
router.patch("/items/:variantId", updateItemHandler);
router.delete("/items/:variantId", removeItemHandler);
router.delete("/", clearCartHandler);

export default router;
