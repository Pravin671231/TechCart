import { Router } from "express";
import { healthModule } from "@/modules/health/health.module";
import adminRouter from "./admin.routes";

const router = Router();

router.use(healthModule.path, healthModule.router);
router.use("/api/admin", adminRouter);

export default router;
