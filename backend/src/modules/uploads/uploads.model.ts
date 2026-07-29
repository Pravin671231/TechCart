import { Schema, model } from "mongoose";

export type PresignedUploadDocument = {
  objectKey: string;
  purpose: string;
  contentType: string;
  expiresAt: Date;
};

const presignedUploadSchema = new Schema<PresignedUploadDocument>({
  objectKey: { type: String, required: true, unique: true },
  purpose: { type: String, required: true },
  contentType: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

// TTL index: Mongo deletes the document once expiresAt is in the past.
// expireAfterSeconds: 0 means "expire at the absolute time stored in the field",
// not "N seconds after the document was created".
presignedUploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PresignedUpload = model<PresignedUploadDocument>(
  "PresignedUpload",
  presignedUploadSchema,
);
