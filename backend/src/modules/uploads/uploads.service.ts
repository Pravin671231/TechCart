import { randomUUID } from "node:crypto";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";
import { createPresignedPutUrl, uploadObject } from "@/externalService/r2";
import { createPendingUpload, consumeByKey } from "./uploads.repository";

export const ALLOWED_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedContentType = keyof typeof ALLOWED_CONTENT_TYPES;

export const UPLOAD_PURPOSES = ["product-image", "brand-logo", "category-image"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const MAX_DIRECT_UPLOAD_BYTES = 5 * 1024 * 1024;

// How long a direct upload's tracking record survives before consumption,
// matching the presigned path's window (FR-CAT-099) even though the file
// itself is already durably in R2 by the time this record is created.
const PENDING_UPLOAD_TTL_SECONDS = 300;

export type PresignResult = {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresAt: Date;
};

export type DirectUploadResult = {
  objectKey: string;
  publicUrl: string;
  expiresAt: Date;
};

export async function issuePresignedUpload(
  purpose: UploadPurpose,
  contentType: AllowedContentType,
): Promise<PresignResult> {
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  const objectKey = `${purpose}/${randomUUID()}.${ext}`;

  const { uploadUrl, expiresAt } = await createPresignedPutUrl(objectKey, contentType);
  await createPendingUpload({ objectKey, purpose, contentType, expiresAt });

  return {
    uploadUrl,
    objectKey,
    publicUrl: `${env.R2.PUBLIC_URL_BASE}/${objectKey}`,
    expiresAt,
  };
}

export async function issueDirectUpload(
  purpose: UploadPurpose,
  contentType: AllowedContentType,
  file: Buffer,
): Promise<DirectUploadResult> {
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  const objectKey = `${purpose}/${randomUUID()}.${ext}`;
  const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_SECONDS * 1000);

  await uploadObject(objectKey, file, contentType);
  await createPendingUpload({ objectKey, purpose, contentType, expiresAt });

  return {
    objectKey,
    publicUrl: `${env.R2.PUBLIC_URL_BASE}/${objectKey}`,
    expiresAt,
  };
}

/**
 * Validates that every object key was actually issued by a prior presign
 * call and hasn't already been consumed (FR-CAT-082). Entity-agnostic: called
 * by product/brand/category create-and-update paths once they exist.
 */
export async function consumeImageKeys(keys: string[]): Promise<void> {
  for (const key of keys) {
    const record = await consumeByKey(key);
    if (!record) {
      throw new AppError(
        400,
        "OBJECT_KEY_NOT_ISSUED",
        `Object key "${key}" was not issued by this server, or has already been consumed.`,
      );
    }
  }
}

/**
 * Enforces an image-count bound (FR-CAT-083). Callers pass { min: 1, max: 8 }
 * for products, { min: 0, max: 2 } for variants.
 */
export function validateImageCount(images: unknown[], bounds: { min: number; max: number }): void {
  if (images.length < bounds.min || images.length > bounds.max) {
    throw new AppError(
      400,
      "IMAGE_COUNT_OUT_OF_BOUNDS",
      `Expected between ${bounds.min} and ${bounds.max} images, got ${images.length}.`,
    );
  }
}

/**
 * Ensures exactly one image is marked primary (FR-CAT-084). If none is
 * marked, the first image is auto-promoted; if more than one is marked, the
 * first marked one wins. Pure function — no I/O.
 */
export function normalizeImages<T extends { isPrimary?: boolean }>(
  images: T[],
): (T & { isPrimary: boolean })[] {
  if (images.length === 0) return [];

  const primaryIndex = images.findIndex((image) => image.isPrimary);
  const winningIndex = primaryIndex === -1 ? 0 : primaryIndex;

  return images.map((image, index) => ({ ...image, isPrimary: index === winningIndex }));
}
