import type { NextFunction, Request, Response } from "express";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";

export function adminAuth(req: Request, _res: Response, next: NextFunction): void {
  const key = req.header("X-Admin-Key");
  if (key !== env.ADMIN_API_KEY) {
    next(new AppError(401, "UNAUTHORIZED", "Missing or invalid admin credentials"));
    return;
  }
  next();
}
