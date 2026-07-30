import { Router } from "express";
import { adminAuth } from "@/middleware/adminAuth";
import { uploadsModule } from "@/modules/uploads/uploads.module";
import { brandsAdminModule } from "@/modules/brands/brands.module";
import { categoriesAdminModule } from "@/modules/categories/categories.module";
import { categorySpecificationsAdminModule } from "@/modules/categorySpecifications/categorySpecifications.module";

const adminRouter = Router();
adminRouter.use(adminAuth);

adminRouter.use(uploadsModule.path, uploadsModule.router);
adminRouter.use(brandsAdminModule.path, brandsAdminModule.router);
adminRouter.use(categoriesAdminModule.path, categoriesAdminModule.router);
adminRouter.use(categorySpecificationsAdminModule.path, categorySpecificationsAdminModule.router);
// Further M2 feature modules (variant types, products, ...) mount here as
// they land, e.g. adminRouter.use(productsModule.path, productsModule.router);

export default adminRouter;
