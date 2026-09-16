"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type AlertVariant = "confirm" | "danger";

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
  confirmDisabled?: boolean;
}

const VARIANT_STYLES: Record<
  AlertVariant,
  { header: string; title: string; confirmButtonClass: string; defaultConfirmLabel: string }
> = {
  confirm: {
    header: "bg-primary-50",
    title: "text-primary-700",
    confirmButtonClass: "bg-gradient-primary text-white hover:brightness-95",
    defaultConfirmLabel: "Confirm",
  },
  danger: {
    header: "bg-red-50",
    title: "text-red-700",
    confirmButtonClass: "bg-red-600 text-white hover:bg-red-700",
    defaultConfirmLabel: "Continue",
  },
};

// buyer-app's own generic confirm/cancel dialog — mirrors admin-app's
// components/ui/AlertModal.tsx API, adapted to this app's conventions (no
// cn helper, no dark mode, no shared Button component). Portaled to
// document.body so its `fixed` positioning always resolves against the true
// viewport — a caller opening this from inside a height-pinned/overflow
// scroll shell (e.g. AccountShell.tsx's account-area layout) would otherwise
// see it pinned near the top instead of centered.
export function AlertModal({
  open,
  variant = "confirm",
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isConfirming,
  confirmDisabled,
}: AlertModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open || !mounted) return null;

  const styles = VARIANT_STYLES[variant];

  return createPortal(
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
        className="relative w-full max-w-sm overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl"
      >
        <div className={`flex items-center justify-between px-4 py-3 ${styles.header}`}>
          <h2 id="alert-modal-title" className={`text-sm font-semibold ${styles.title}`}>
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className={`rounded-md p-1 hover:bg-black/5 ${styles.title}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-4 py-4 text-sm text-neutral-600">{message}</div>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            type="button"
            disabled={isConfirming}
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isConfirming || confirmDisabled}
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles.confirmButtonClass}`}
          >
            {isConfirming ? "Working…" : (confirmLabel ?? styles.defaultConfirmLabel)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
