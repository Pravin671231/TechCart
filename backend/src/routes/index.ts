import { Router } from "express";
import { healthModule } from "@/modules/health/health.module";

const router = Router();

router.use(healthModule.path, healthModule.router);

export default router;
