import { LuUpload, LuX } from "react-icons/lu";
import type { ProductImage } from "@/features/product-catalog/product-form/types";

type ImageDropzoneProps = {
  images: ProductImage[];
  maxImages?: number;
  minImages?: number;
  compact?: boolean;
  onAdd: (file?: File) => void;
  onRemove: (id: string) => void;
  onSetPrimary?: (id: string) => void;
  onAltChange?: (id: string, alt: string) => void;
};

export function ImageDropzone({
  images,
  maxImages = 8,
  minImages = 1,
  compact = false,
  onAdd,
  onRemove,
  onSetPrimary,
  onAltChange,
}: ImageDropzoneProps) {
  const atMax = images.length >= maxImages;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => onAdd(file));
    event.target.value = "";
  }

  return (
    <div>
      <p className="mb-2 text-xs text-neutral-500">
        {images.length} of {maxImages}
        {minImages > 0 ? ` · at least ${minImages} required` : ""} · JPEG, PNG, or WebP only
      </p>

      {!atMax && (
        <label
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-center text-sm text-neutral-500 hover:border-primary-600 hover:text-primary-600 ${
            compact ? "aspect-[3/1] p-3" : "aspect-video"
          }`}
        >
          <LuUpload className="h-6 w-6" />
          <span>
            Drop your image here or <span className="font-medium text-primary-600">Browse file</span>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      )}

      {images.length > 0 && (
        <div className={`mt-3 grid gap-3 ${compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-4 sm:grid-cols-6"}`}>
          {images.map((image) => (
            <div
              key={image.id}
              className={`relative rounded-md border p-2 ${image.isPrimary ? "border-2 border-primary-600" : "border-neutral-200"}`}
            >
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => onRemove(image.id)}
                className="absolute -top-2 -right-2 rounded-full border border-neutral-200 bg-white p-1"
              >
                <LuX className="h-3 w-3 text-neutral-500" />
              </button>

              <div className="flex aspect-square items-center justify-center bg-neutral-100 text-[10px] text-neutral-400">
                preview
              </div>

              {onSetPrimary ? (
                <label className="mt-1 flex items-center gap-1 text-xs text-neutral-600">
                  <input
                    type="radio"
                    name="primary-image"
                    className="accent-primary-600"
                    checked={image.isPrimary}
                    onChange={() => onSetPrimary(image.id)}
                  />
                  Primary
                </label>
              ) : null}

              {onAltChange ? (
                <input
                  type="text"
                  value={image.alt ?? ""}
                  onChange={(event) => onAltChange(image.id, event.target.value)}
                  placeholder="alt text…"
                  className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-[11px] text-neutral-600 placeholder:text-neutral-400"
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
