import express, { Router } from "express";
import { accountModule } from "@/modules/authentication/account/account.module";
import { authModule } from "@/modules/authentication/auth/auth.module";
import { addressesModule } from "@/modules/addresses/addresses.module";
import { cartModule } from "@/modules/cart/cart.module";
import { ordersModule } from "@/modules/orders/orders.module";
import { healthModule } from "@/modules/health/health.module";
import { brandsPublicModule } from "@/modules/product-catalog/features/brands/brands.module";
import { categoriesPublicModule } from "@/modules/product-catalog/features/categories/categories.module";
import { productsPublicModule } from "@/modules/product-catalog/features/products/products.module";
import adminRouter from "./admin.routes";

const router = Router();

// Mounted ahead of the global express.json() below — each hand-rolled auth
// route declares its own route-scoped express.json() (auth.routes.ts), so
// body parsing for /api/auth/* stays owned by that module. Historically this
// ordering was required because Better Auth's catch-all needed the raw,
// unparsed body stream (#139); it's kept now as the module's own convention.
router.use(authModule.path, authModule.router);

router.use(express.json());
router.use(accountModule.path, accountModule.router);
router.use(addressesModule.path, addressesModule.router);
router.use(cartModule.path, cartModule.router);
router.use(ordersModule.path, ordersModule.router);
router.use(healthModule.path, healthModule.router);
router.use(brandsPublicModule.path, brandsPublicModule.router);
router.use(categoriesPublicModule.path, categoriesPublicModule.router);
router.use(productsPublicModule.path, productsPublicModule.router);
router.use("/api/admin", adminRouter);

export default router;
