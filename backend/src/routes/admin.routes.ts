import { Router } from "express";
import { adminAuth } from "@/middleware/adminAuth";
import { uploadsModule } from "@/modules/uploads/uploads.module";
import { brandsAdminModule } from "@/modules/brands/brands.module";
import { categoriesAdminModule } from "@/modules/categories/categories.module";
import { categorySpecificationsAdminModule } from "@/modules/categorySpecifications/categorySpecifications.module";
import { categoryVariantsAdminModule } from "@/modules/categoryVariants/categoryVariants.module";
import { productsAdminModule } from "@/modules/products/products.module";

const adminRouter = Router();
adminRouter.use(adminAuth);

adminRouter.use(uploadsModule.path, uploadsModule.router);
adminRouter.use(brandsAdminModule.path, brandsAdminModule.router);
adminRouter.use(categoriesAdminModule.path, categoriesAdminModule.router);
adminRouter.use(categorySpecificationsAdminModule.path, categorySpecificationsAdminModule.router);
adminRouter.use(categoryVariantsAdminModule.path, categoryVariantsAdminModule.router);
adminRouter.use(productsAdminModule.path, productsAdminModule.router);
// Further M2 feature modules (product variants, ...) mount here as they
// land, e.g. adminRouter.use(productVariantsModule.path, ...).

export default adminRouter;
