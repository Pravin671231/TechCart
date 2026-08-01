import { Router } from "express";
import { listPublicProductsHandler, getPublicProductHandler } from "./products.controller";

const router = Router();

router.get("/", listPublicProductsHandler);
router.get("/:slug", getPublicProductHandler);

export default router;
