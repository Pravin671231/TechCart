import { Router } from "express";
import { listProductsByCategorySlugHandler } from "@/modules/products/products.controller";
import { listPublicCategoriesHandler, searchPublicCategoriesHandler } from "./categories.controller";

const router = Router();

// /search before /:slug/products — both are more specific than a bare "/",
// and neither collides with the other (distinct literal first segments), so
// declaration order doesn't actually matter here; kept in this order to read
// top-to-bottom as "list, search, then the one cross-module route."
router.get("/", listPublicCategoriesHandler);
router.get("/search", searchPublicCategoriesHandler);
// FR-CAT-055 — the controller lives in products.controller.ts (it returns
// products, not categories); only this route's wiring crosses modules, the
// same way brands.service.ts/categories.service.ts already reach into
// products.repository.ts for their own delete-guard counts.
router.get("/:slug/products", listProductsByCategorySlugHandler);

export default router;
