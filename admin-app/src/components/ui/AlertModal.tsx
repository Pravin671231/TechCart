import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export type AlertVariant = "deleted" | "warning" | "confirm";

export interface AlertModalProps {
  open: boolean;
  variant?: AlertVariant;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
  /** Disables the confirm button without touching isConfirming's own loading-label behavior — e.g. a required field in `message` that isn't filled in yet (Issue #163's CancelOrderModal). */
  confirmDisabled?: boolean;
}

const VARIANT_STYLES: Record<
  AlertVariant,
  {
    border: string;
    header: string;
    title: string;
    confirmButtonClass: string;
    defaultConfirmLabel: string;
    defaultLoadingLabel: string;
  }
> = {
  deleted: {
    border: "border-red-200",
    header: "bg-red-50",
    title: "text-red-800",
    confirmButtonClass: "bg-red-600 text-white hover:bg-red-700",
    defaultConfirmLabel: "Delete",
    defaultLoadingLabel: "Deleting…",
  },
  warning: {
    border: "border-amber-200",
    header: "bg-amber-50",
    title: "text-amber-800",
    confirmButtonClass: "bg-amber-600 text-white hover:bg-amber-700",
    defaultConfirmLabel: "Continue",
    defaultLoadingLabel: "Working…",
  },
  confirm: {
    border: "border-green-200",
    header: "bg-green-50",
    title: "text-green-800",
    confirmButtonClass: "bg-green-600 text-white hover:bg-green-700",
    defaultConfirmLabel: "Confirm",
    defaultLoadingLabel: "Working…",
  },
};

export const AlertModal = ({
  open,
  variant = "deleted",
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isConfirming,
  confirmDisabled,
}: AlertModalProps) => {
  if (!open) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={cancelLabel}
        onClick={onCancel}
        className="absolute inset-0 bg-neutral-900/40"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-lg border-2 bg-white shadow-xl",
          styles.border,
        )}
      >
        <div className={cn("flex items-center justify-between px-4 py-3", styles.header)}>
          <h2 id="alert-modal-title" className={cn("text-sm font-semibold", styles.title)}>
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className={cn("rounded-md p-1 hover:bg-black/5", styles.title)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="px-4 py-4 text-sm text-neutral-600">{message}</p>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            loading={isConfirming}
            loadingLabel={styles.defaultLoadingLabel}
            disabled={confirmDisabled}
            className={styles.confirmButtonClass}
          >
            {confirmLabel ?? styles.defaultConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
