import { Router } from "express";
import { adminAuth } from "@/middleware/adminAuth";

const adminRouter = Router();
adminRouter.use(adminAuth);

// M2 feature modules (brands, categories, products, ...) mount here as they land,
// e.g. adminRouter.use(brandModule.path, brandModule.router);

export default adminRouter;
