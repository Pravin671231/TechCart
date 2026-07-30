import { Router } from "express";
import { listPublicCategoriesHandler } from "./categories.controller";

const router = Router();

router.get("/", listPublicCategoriesHandler);

export default router;
