import { useState, type ChangeEvent } from "react";
import { usePresignUploadMutation, putFileToPresignedUrl } from "@/features/uploads/uploadsApi";
import type { UploadContentType, UploadPurpose } from "@/features/uploads/uploadsApi";

const ACCEPTED_CONTENT_TYPES: UploadContentType[] = ["image/jpeg", "image/png", "image/webp"];

export interface UploadedImage {
  objectKey: string;
  publicUrl: string;
  alt: string;
  isPrimary: boolean;
}

export interface ProductImagesEditorProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  min: number;
  max: number;
  purpose: UploadPurpose;
  label?: string;
}

// Promotes the first remaining image to primary whenever none is marked —
// a client-side mirror of uploads.service.ts's normalizeImages(), purely for
// immediate feedback; the backend re-normalizes independently on submit.
function withPrimaryGuaranteed(images: UploadedImage[]): UploadedImage[] {
  if (images.length === 0 || images.some((image) => image.isPrimary)) return images;
  return images.map((image, index) => ({ ...image, isPrimary: index === 0 }));
}

export function ProductImagesEditor({
  images,
  onChange,
  min,
  max,
  purpose,
  label = "Images",
}: ProductImagesEditorProps) {
  const [presignUpload, { isLoading }] = usePresignUploadMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (images.length >= max) {
      setError(`Only ${max} images are allowed.`);
      return;
    }
    if (!ACCEPTED_CONTENT_TYPES.includes(file.type as UploadContentType)) {
      setError("Image must be a JPEG, PNG, or WebP file.");
      return;
    }

    try {
      const presigned = await presignUpload({
        purpose,
        contentType: file.type as UploadContentType,
      }).unwrap();
      await putFileToPresignedUrl(presigned.uploadUrl, file);
      const next: UploadedImage = {
        objectKey: presigned.objectKey,
        publicUrl: presigned.publicUrl,
        alt: "",
        isPrimary: images.length === 0,
      };
      onChange(withPrimaryGuaranteed([...images, next]));
    } catch {
      setError("Image upload failed. Please try again.");
    }
  }

  function updateImage(index: number, patch: Partial<UploadedImage>) {
    const next = images.map((image, i) => (i === index ? { ...image, ...patch } : image));
    onChange(withPrimaryGuaranteed(next));
  }

  function makePrimary(index: number) {
    onChange(images.map((image, i) => ({ ...image, isPrimary: i === index })));
  }

  function removeImage(index: number) {
    onChange(withPrimaryGuaranteed(images.filter((_image, i) => i !== index)));
  }

  return (
    <div>
      <span className="block text-sm font-medium text-neutral-700">{label}</span>
      <p className="mt-1 text-[11px] text-neutral-400">
        {images.length} of {max}
        {min > 0 ? ` · at least ${min} required` : ""} · JPEG, PNG, or WebP only
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((image, index) => (
          <div
            key={image.objectKey}
            className={`rounded-lg border p-2 ${image.isPrimary ? "border-2 border-primary-600" : "border-neutral-200"}`}
          >
            <img
              src={image.publicUrl}
              alt={image.alt || "Product image preview"}
              className="mb-2 aspect-square w-full rounded-md object-cover"
            />
            <button
              type="button"
              onClick={() => makePrimary(index)}
              className={image.isPrimary ? "text-xs font-medium text-primary-700" : "text-xs text-neutral-500"}
            >
              {image.isPrimary ? "◉ Primary" : "○ Primary"}
            </button>
            <input
              type="text"
              value={image.alt}
              aria-label={`Alt text for image ${index + 1}`}
              placeholder="alt text…"
              onChange={(event) => updateImage(index, { alt: event.target.value })}
              className="mt-1 block w-full rounded-md border border-neutral-200 px-2 py-1 text-[11px]"
            />
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="mt-1 text-[11px] text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        {images.length < max && (
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-neutral-300 text-center text-xs font-medium text-primary-600 hover:bg-primary-50">
            {isLoading ? "Uploading…" : "+ Upload"}
            <input
              type="file"
              accept={ACCEPTED_CONTENT_TYPES.join(",")}
              onChange={(event) => void handleFileChange(event)}
              disabled={isLoading}
              className="sr-only"
            />
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
