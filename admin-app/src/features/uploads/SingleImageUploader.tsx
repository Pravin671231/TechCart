import { useState, type ChangeEvent } from "react";
import { usePresignUploadMutation, putFileToPresignedUrl } from "./uploadsApi";
import type { UploadContentType, UploadPurpose } from "./uploadsApi";

const ACCEPTED_CONTENT_TYPES: UploadContentType[] = ["image/jpeg", "image/png", "image/webp"];

export interface SingleImageUploaderProps {
  label: string;
  purpose: UploadPurpose;
  previewUrl?: string;
  onUploaded: (result: { objectKey: string; publicUrl: string }) => void;
}

export function SingleImageUploader({ label, purpose, previewUrl, onUploaded }: SingleImageUploaderProps) {
  const [presignUpload, { isLoading }] = usePresignUploadMutation();
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | undefined>(previewUrl);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ACCEPTED_CONTENT_TYPES.includes(file.type as UploadContentType)) {
      setError(`${label} must be a JPEG, PNG, or WebP image.`);
      return;
    }

    try {
      const presigned = await presignUpload({ purpose, contentType: file.type as UploadContentType }).unwrap();
      await putFileToPresignedUrl(presigned.uploadUrl, file);
      setLocalPreview(presigned.publicUrl);
      onUploaded({ objectKey: presigned.objectKey, publicUrl: presigned.publicUrl });
    } catch {
      setError(`${label} upload failed. Please try again.`);
    }
  }

  return (
    <div>
      <span className="block text-sm font-medium text-neutral-700">{label}</span>
      <div className="mt-1 flex items-center gap-3">
        {localPreview ? (
          <img
            src={localPreview}
            alt={`${label} preview`}
            className="h-12 w-24 rounded-md border border-neutral-200 object-cover"
          />
        ) : (
          <span className="block h-12 w-24 rounded-md border border-dashed border-neutral-300 bg-neutral-50" />
        )}
        <label className="cursor-pointer rounded-md border border-neutral-400 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          {isLoading ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept={ACCEPTED_CONTENT_TYPES.join(",")}
            onChange={handleFileChange}
            disabled={isLoading}
            className="sr-only"
          />
        </label>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
