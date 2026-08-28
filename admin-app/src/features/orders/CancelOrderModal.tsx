import { useState } from "react";
import { AlertModal } from "@/components/ui/AlertModal";

// FR-ORD-015 — admin cancellation requires a reason, unlike buyer
// self-cancellation. AlertModal's own `message` slot is a ReactNode, so the
// reason textarea lives there; the trimmed value is threaded back to the
// caller only on confirm, via a new confirmDisabled prop on AlertModal
// (added by this issue) rather than silently no-oping on an empty reason.
export interface CancelOrderModalProps {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export const CancelOrderModal = ({
  open,
  onConfirm,
  onCancel,
  isConfirming,
}: CancelOrderModalProps) => {
  const [reason, setReason] = useState("");

  function handleCancel() {
    setReason("");
    onCancel();
  }

  function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setReason("");
  }

  return (
    <AlertModal
      open={open}
      variant="warning"
      title="Cancel this order?"
      message={
        <div className="flex flex-col gap-2">
          <p>This cancels the order and can&apos;t be undone. Provide a reason for the buyer.</p>
          <label htmlFor="cancel-order-reason" className="text-xs font-medium text-neutral-700">
            Cancellation reason
          </label>
          <textarea
            id="cancel-order-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="e.g. Item out of stock"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
          />
        </div>
      }
      confirmLabel="Cancel order"
      cancelLabel="Keep order"
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      isConfirming={isConfirming}
      confirmDisabled={reason.trim().length === 0}
    />
  );
};
