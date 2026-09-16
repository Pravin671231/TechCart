"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useMounted } from "@/hooks/useMounted";

// Generic dialog shell (title + close + scrollable body) — distinct from
// AlertModal.tsx's confirm/cancel-specific dialog: this one owns only the
// chrome and lets `children` own the body/footer (e.g. AddressForm's own
// Save/Cancel buttons). Portaled to document.body for the same reason
// AlertModal is — `fixed` positioning must resolve against the true
// viewport, not whatever scroll shell (e.g. AccountShell) opened it from.
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const mounted = useMounted();

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal-enter scrollbar-brand relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
