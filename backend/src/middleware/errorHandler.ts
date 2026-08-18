import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { AppError } from "@/utils/AppError";
import { env } from "@/config/env";

// err is `unknown` — not guaranteed to be an Error instance, so this pulls
// out message/name/stack defensively rather than assuming shape.
function extractErrorInfo(err: unknown): { message: string; name: string; stack?: string } {
  if (err instanceof Error) {
    const info: { message: string; name: string; stack?: string } = {
      message: err.message,
      name: err.name,
    };
    if (err.stack !== undefined) info.stack = err.stack;
    return info;
  }
  return { message: String(err), name: "UnknownError" };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    const errors = err.issues.reduce<Record<string, string>>((acc, issue) => {
      const field = issue.path.join(".");
      acc[field] = issue.message;
      return acc;
    }, {});

    res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      errors,
    });
    return;
  }

  if (err instanceof MulterError) {
    const code = err.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_ERROR";

    res.status(400).json({
      success: false,
      code,
      message: err.message,
    });
    return;
  }

  // Always logged server-side, in every environment — a client always gets a
  // safe response, but the error itself must never be silently invisible.
  console.error(err);

  // Fail-safe: only NODE_ENV === "development" gets the detailed shape.
  // Production, test, and any unrecognized value all keep the generic one.
  if (env.NODE_ENV !== "development") {
    res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    return;
  }

  const info = extractErrorInfo(err);
  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: info.message,
    name: info.name,
    ...(info.stack !== undefined ? { stack: info.stack } : {}),
  });
}
