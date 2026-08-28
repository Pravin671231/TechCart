import { Router } from "express";
import { rbac } from "@/middleware/rbac";
import {
  addAddressHandler,
  deleteAddressHandler,
  listAddressesHandler,
  setDefaultAddressHandler,
  updateAddressHandler,
} from "./addresses.controller";

const router = Router();

// FR-ORD-028-032 — every address endpoint requires a buyer session; no
// admin surface exists for this module (SRS v0.5 §2.1 defines none).
router.use(rbac(["buyer"]));

router.get("/", listAddressesHandler);
router.post("/", addAddressHandler);
router.patch("/:id", updateAddressHandler);
router.delete("/:id", deleteAddressHandler);
router.patch("/:id/default", setDefaultAddressHandler);

export default router;
