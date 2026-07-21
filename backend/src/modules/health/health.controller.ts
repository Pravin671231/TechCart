import type { Request, Response } from "express";
import { getHealthStatus } from "./health.service";

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    code: "OK",
    message: getHealthStatus(),
  });
}
