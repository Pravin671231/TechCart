import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import {
  ALLOWED_CONTENT_TYPES,
  UPLOAD_PURPOSES,
  issueDirectUpload,
  issuePresignedUpload,
  type AllowedContentType,
} from "./uploads.service";

const presignSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const directUploadSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
});

function isAllowedContentType(contentType: string): contentType is AllowedContentType {
  return contentType in ALLOWED_CONTENT_TYPES;
}

export async function presign(req: Request, res: Response): Promise<void> {
  const { purpose, contentType } = presignSchema.parse(req.body);

  const result = await issuePresignedUpload(purpose, contentType);

  res.status(200).json(successResponse(result));
}

export async function directUpload(req: Request, res: Response): Promise<void> {
  const { purpose } = directUploadSchema.parse(req.body);

  if (!req.file) {
    throw new AppError(400, "NO_FILE_UPLOADED", 'No file was uploaded under the "file" field.');
  }

  const { mimetype, buffer } = req.file;
  if (!isAllowedContentType(mimetype)) {
    throw new AppError(
      400,
      "UNSUPPORTED_CONTENT_TYPE",
      `Content type "${mimetype}" is not one of the allowed image types.`,
    );
  }

  const result = await issueDirectUpload(purpose, mimetype, buffer);

  res.status(200).json(successResponse(result));
}
