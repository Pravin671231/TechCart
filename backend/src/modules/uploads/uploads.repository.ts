import { PresignedUpload, type PresignedUploadDocument } from "./uploads.model";

export async function createPendingUpload(doc: PresignedUploadDocument): Promise<void> {
  await PresignedUpload.create(doc);
}

/**
 * Atomically finds and deletes the tracking record for a key. Returns null if
 * the key was never issued, was already consumed, or has expired (and been
 * TTL-swept) — all three collapse to the same "not valid" outcome for callers.
 */
export async function consumeByKey(objectKey: string): Promise<PresignedUploadDocument | null> {
  return PresignedUpload.findOneAndDelete({ objectKey }).lean();
}
