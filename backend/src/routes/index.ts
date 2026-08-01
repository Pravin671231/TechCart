import { Router } from "express";
import { healthModule } from "@/modules/health/health.module";
import { brandsPublicModule } from "@/modules/brands/brands.module";
import { categoriesPublicModule } from "@/modules/categories/categories.module";
import { productsPublicModule } from "@/modules/products/products.module";
import adminRouter from "./admin.routes";

const router = Router();

router.use(healthModule.path, healthModule.router);
router.use(brandsPublicModule.path, brandsPublicModule.router);
router.use(categoriesPublicModule.path, categoriesPublicModule.router);
router.use(productsPublicModule.path, productsPublicModule.router);
router.use("/api/admin", adminRouter);

export default router;
