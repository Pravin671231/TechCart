import { useState } from "react";
import { AlertModal } from "@/components/ui/AlertModal";

// FR-PAY-012-018 — admin-initiated refund. Mirrors CancelOrderModal's
// AlertModal-with-extra-input shape. Amount is entered in rupees (matching
// every other money display in this app) and converted to integer paise at
// confirm time, since backend's refundSchema is paise-denominated
// (payments.amount, and every payment-module field, are paise — the one
// exception to the whole-rupees convention every other money field in this
// codebase uses). Left blank, amount is omitted from the request entirely
// — backend's own documented sentinel for "refund the full remaining
// balance" (refundSchema's `amount` is optional for exactly this reason),
// so there's no need to compute a remaining-balance default client-side
// (PaymentSummary carries no refund history to compute one from anyway).
export interface RefundOrderModalProps {
  open: boolean;
  onConfirm: (args: { amountPaise?: number; reason: string }) => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export const RefundOrderModal = ({
  open,
  onConfirm,
  onCancel,
  isConfirming,
}: RefundOrderModalProps) => {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  function reset() {
    setAmount("");
    setReason("");
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  function handleConfirm() {
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;

    const trimmedAmount = amount.trim();
    let amountPaise: number | undefined;
    if (trimmedAmount) {
      const rupees = Number(trimmedAmount);
      if (!Number.isFinite(rupees) || rupees <= 0) return;
      amountPaise = Math.round(rupees * 100);
    }

    onConfirm({ amountPaise, reason: trimmedReason });
    reset();
  }

  return (
    <AlertModal
      open={open}
      variant="confirm"
      title="Refund this order?"
      message={
        <div className="flex flex-col gap-3">
          <p>
            Leave the amount blank to refund the full remaining balance, or enter a partial amount.
            This calls Razorpay and can&apos;t be undone.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-700">
              Refund amount (₹) — optional, blank = full refund
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Full remaining balance"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
            />
          </label>
          <label htmlFor="refund-order-reason" className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-700">Refund reason</span>
            <textarea
              id="refund-order-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="e.g. Customer request"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
            />
          </label>
        </div>
      }
      confirmLabel="Refund order"
      cancelLabel="Cancel"
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      isConfirming={isConfirming}
      confirmDisabled={reason.trim().length === 0}
    />
  );
};
