import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { getSalesSummary, getSalesOverTime, getTopProducts } from "./dashboard.service";

// Accepts either a plain date ("2026-01-01") or a full ISO datetime — actual
// validity is checked by dateRange.ts's resolveDateRange (new Date(...)),
// which throws the real 400 INVALID_DATE_RANGE for anything unparseable.
const rangeQuerySchema = z.object({
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});

export async function getSalesSummaryHandler(req: Request, res: Response): Promise<void> {
  const { from, to } = rangeQuerySchema.parse(req.query);
  const summary = await getSalesSummary(from, to);
  res.status(200).json(successResponse(summary));
}

export async function getSalesOverTimeHandler(req: Request, res: Response): Promise<void> {
  const { from, to } = rangeQuerySchema.parse(req.query);
  const series = await getSalesOverTime(from, to);
  res.status(200).json(successResponse(series));
}

export async function getTopProductsHandler(req: Request, res: Response): Promise<void> {
  const { from, to } = rangeQuerySchema.parse(req.query);
  const products = await getTopProducts(from, to);
  res.status(200).json(successResponse(products));
}
