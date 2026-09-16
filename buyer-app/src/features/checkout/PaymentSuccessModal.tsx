"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useMounted } from "@/hooks/useMounted";
import { formatPrice } from "@/features/products/money";

const REDIRECT_DELAY_SECONDS = 5;

// A transient, non-interactive success state — no confirm/cancel actions, no
// Escape/backdrop dismiss (mirrors components/ui/AlertModal.tsx's portal +
// useMounted conventions, minus the decision it exists to make). Owns its
// own countdown and redirect so PaymentStep doesn't need any timer logic of
// its own.
export function PaymentSuccessModal({
  orderNumber,
  amount,
}: {
  orderNumber: string;
  amount: number;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_DELAY_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.push("/");
      return;
    }
    const timeoutId = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timeoutId);
    // router deliberately omitted — see PaymentStep.tsx's own main effect for
    // the identical reasoning: a test double for next/navigation's
    // useRouter returns a fresh object every render, which would otherwise
    // reset this countdown's pending timeout on any unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/40" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="payment-success-title"
        className="relative w-full max-w-sm overflow-hidden rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-xl"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
          <CheckCircle2 className="h-7 w-7 text-primary-600" aria-hidden="true" />
        </div>
        <h2 id="payment-success-title" className="mt-4 text-lg font-semibold text-neutral-900">
          Payment successful
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Order #{orderNumber} · {formatPrice(amount)}
        </p>
        <p className="mt-4 text-xs text-neutral-500">
          Redirecting to home in {secondsLeft}s…
        </p>
      </div>
    </div>,
    document.body,
  );
}
