import { Router } from "express";
import { uploadsModule } from "@/modules/uploads/uploads.module";
import { adminUsersModule } from "@/modules/authentication/adminUsers/adminUsers.module";
import { brandsAdminModule } from "@/modules/product-catalog/features/brands/brands.module";
import { categoriesAdminModule } from "@/modules/product-catalog/features/categories/categories.module";
import { categorySpecificationsAdminModule } from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.module";
import { categoryVariantsAdminModule } from "@/modules/product-catalog/features/categoryVariants/categoryVariants.module";
import { productsAdminModule } from "@/modules/product-catalog/features/products/products.module";
import { ordersAdminModule } from "@/modules/orders/orders.module";

// Issue #143/M3.5 — the temporary X-Admin-Key guard (adminAuth.ts) that used
// to be applied once here for the whole router is gone; every module below
// now carries its own rbac(...) guard at its own router's mount (see e.g.
// uploads.routes.ts, brands.admin.routes.ts) — the same convention
// adminUsersModule already established in #142.
const adminRouter = Router();

adminRouter.use(uploadsModule.path, uploadsModule.router);
adminRouter.use(adminUsersModule.path, adminUsersModule.router);
adminRouter.use(brandsAdminModule.path, brandsAdminModule.router);
adminRouter.use(categoriesAdminModule.path, categoriesAdminModule.router);
adminRouter.use(categorySpecificationsAdminModule.path, categorySpecificationsAdminModule.router);
adminRouter.use(categoryVariantsAdminModule.path, categoryVariantsAdminModule.router);
adminRouter.use(productsAdminModule.path, productsAdminModule.router);
adminRouter.use(ordersAdminModule.path, ordersAdminModule.router);

export default adminRouter;
