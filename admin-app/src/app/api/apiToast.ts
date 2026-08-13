import { toast } from "sonner";
import { getApiErrorEnvelope } from "./apiError";

export function notifyApiSuccess(message: string): void {
  toast.success(message);
}

export function notifyApiError(error: unknown, fallbackMessage: string): void {
  toast.error(getApiErrorEnvelope(error)?.message ?? fallbackMessage);
}
