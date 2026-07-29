import { Router } from "express";
import { adminAuth } from "@/middleware/adminAuth";
import { uploadsModule } from "@/modules/uploads/uploads.module";

const adminRouter = Router();
adminRouter.use(adminAuth);

adminRouter.use(uploadsModule.path, uploadsModule.router);
// Further M2 feature modules (brands, categories, products, ...) mount here as
// they land, e.g. adminRouter.use(brandModule.path, brandModule.router);

export default adminRouter;
