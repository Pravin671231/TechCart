import type { NextFunction, Request, Response } from "express";
import { isDatabaseGateTripped } from "@/config/db";
import { AppError } from "@/utils/AppError";

// FR-NFR-BE-003 — fail fast with a specific 503 when the MongoDB connection
// is down, rather than letting every query buffer until a client-side
// timeout. The driver reconnects on its own (with backoff); this middleware
// just short-circuits requests during the gap. `/health` is deliberately
// exempt so a deploy platform's liveness probe still gets an answer while
// the DB is unreachable (deepening /health to report dependency health is
// FR-NFR-BE-018, a separate issue).
export function databaseReady(req: Request, _res: Response, next: NextFunction): void {
  if (req.path === "/health") {
    next();
    return;
  }

  if (isDatabaseGateTripped()) {
    throw new AppError(
      503,
      "DATABASE_UNAVAILABLE",
      "The database is temporarily unavailable. Please retry shortly.",
    );
  }

  next();
}
