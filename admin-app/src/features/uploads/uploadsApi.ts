import { api, unwrapData } from "@/store/api";
import type { ApiSuccessEnvelope } from "@/store/api";

export const UPLOAD_PURPOSES = ["product-image", "brand-logo", "category-image"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export type UploadContentType = "image/jpeg" | "image/png" | "image/webp";

export interface PresignUploadInput {
  purpose: UploadPurpose;
  contentType: UploadContentType;
}

export interface PresignUploadResult {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresAt: string;
}

export const uploadsApi = api.injectEndpoints({
  endpoints: (build) => ({
    presignUpload: build.mutation<PresignUploadResult, PresignUploadInput>({
      query: (body) => ({ url: "/uploads/presign", method: "POST", body }),
      transformResponse: (response: ApiSuccessEnvelope<PresignUploadResult>) =>
        unwrapData(response),
    }),
  }),
});

export const { usePresignUploadMutation } = uploadsApi;

export async function putFileToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload to storage failed with status ${response.status}`);
  }
}
