import { toast } from "sonner";
import type { NormalizedApiError } from "@/store/api";

// Shared fallback for any RTK Query mutation rejection that doesn't need its
// own error-code-specific message — surfaces the backend's own message when
// present, otherwise a generic fallback.
export function showApiErrorToast(err: unknown, fallback = "Something went wrong. Please try again.") {
  const apiError = err as NormalizedApiError;
  toast.error(apiError?.message || fallback);
}
