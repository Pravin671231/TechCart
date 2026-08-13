import type { ApiErrorEnvelope } from "./api.types";

export function getApiErrorEnvelope(error: unknown): ApiErrorEnvelope | undefined {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "code" in data) {
      return data as ApiErrorEnvelope;
    }
  }
  return undefined;
}
