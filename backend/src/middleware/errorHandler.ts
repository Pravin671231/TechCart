import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { AppError } from "@/utils/AppError";

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

  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  });
}
