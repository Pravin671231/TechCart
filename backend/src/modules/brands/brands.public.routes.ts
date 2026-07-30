import { Router } from "express";
import { listPublicBrandsHandler } from "./brands.controller";

const router = Router();

router.get("/", listPublicBrandsHandler);

export default router;
