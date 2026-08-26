import express, { Router } from "express";
import { accountModule } from "@/modules/authentication/account/account.module";
import { authModule } from "@/modules/authentication/auth/auth.module";
import { healthModule } from "@/modules/health/health.module";
import { brandsPublicModule } from "@/modules/product-catalog/features/brands/brands.module";
import { categoriesPublicModule } from "@/modules/product-catalog/features/categories/categories.module";
import { productsPublicModule } from "@/modules/product-catalog/features/products/products.module";
import adminRouter from "./admin.routes";

const router = Router();

// Ahead of express.json() below — Better Auth needs the raw, unparsed
// request body/stream (#139, SRS v0.3).
router.use(authModule.path, authModule.router);

router.use(express.json());
router.use(accountModule.path, accountModule.router);
router.use(healthModule.path, healthModule.router);
router.use(brandsPublicModule.path, brandsPublicModule.router);
router.use(categoriesPublicModule.path, categoriesPublicModule.router);
router.use(productsPublicModule.path, productsPublicModule.router);
router.use("/api/admin", adminRouter);

export default router;
