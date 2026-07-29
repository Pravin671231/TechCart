import { Router } from "express";
import { adminAuth } from "@/middleware/adminAuth";
import { uploadsModule } from "@/modules/uploads/uploads.module";
import { brandsAdminModule } from "@/modules/brands/brands.module";

const adminRouter = Router();
adminRouter.use(adminAuth);

adminRouter.use(uploadsModule.path, uploadsModule.router);
adminRouter.use(brandsAdminModule.path, brandsAdminModule.router);
// Further M2 feature modules (categories, products, ...) mount here as they
// land, e.g. adminRouter.use(categoriesModule.path, categoriesModule.router);

export default adminRouter;
