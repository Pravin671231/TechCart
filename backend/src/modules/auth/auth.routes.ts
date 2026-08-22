import { Router } from "express";
import { betterAuthHandler } from "@/middleware/betterAuthHandler";

const router = Router();

router.all("/*splat", betterAuthHandler);

export default router;
