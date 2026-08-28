"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { formatPrice } from "@/features/products/money";
import { useInitiatePaymentMutation, useVerifyPaymentMutation } from "./api";
import type { CheckoutResponse } from "./types";
import type { NormalizedApiError } from "@/store/api";

type PaymentStatus = "idle" | "verifying" | "failed";

// FR-PAY §6 (buyer-app UI/UX) — replaces the old "payment coming soon"
// placeholder: launches the Razorpay Checkout widget using
// POST .../payment's response, verifies the widget's own success callback
// server-side, and redirects to the order detail view. A failure or
// dismissal returns the buyer to a retry state on the same order rather
// than forcing a fresh checkout — retrying re-calls POST .../payment,
// which the backend already mints a fresh Razorpay order for after a
// failed attempt (FR-PAY-011).
export function PaymentStep({ order }: { order: CheckoutResponse }) {
  const router = useRouter();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const [initiatePayment] = useInitiatePaymentMutation();
  const [verifyPayment] = useVerifyPaymentMutation();

  useEffect(() => {
    if (!scriptLoaded || !window.Razorpay) return;

    let cancelled = false;

    initiatePayment({ orderId: order.id })
      .unwrap()
      .then((result) => {
        if (cancelled || !window.Razorpay) return;
        const razorpay = new window.Razorpay({
          key: result.keyId,
          amount: result.amount,
          currency: result.currency,
          name: "TechCart",
          description: `Order #${order.orderNumber}`,
          order_id: result.razorpayOrderId,
          handler: (response) => {
            if (cancelled) return;
            setStatus("verifying");
            verifyPayment({
              orderId: order.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
              .unwrap()
              .then(() => {
                if (!cancelled) router.push(`/orders/${order.id}`);
              })
              .catch((err: unknown) => {
                if (cancelled) return;
                const apiError = err as NormalizedApiError;
                setError(
                  apiError?.message || "We couldn't confirm your payment. Please try again.",
                );
                setStatus("failed");
              });
          },
          modal: {
            ondismiss: () => {
              if (!cancelled) setStatus("failed");
            },
          },
          theme: { color: "#4f46e5" },
        });
        razorpay.open();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const apiError = err as NormalizedApiError;
        setError(apiError?.message || "Unable to start payment. Please try again.");
        setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
    // Deliberately re-runs only on scriptLoaded/attempt (attempt is the
    // retry trigger). initiatePayment/verifyPayment/router are omitted on
    // purpose, not an oversight: a test double for next/navigation's
    // useRouter that returns a fresh object per render (a common, valid
    // mock shape) turns "router" into an unstable dependency and re-triggers
    // this effect every render — a real infinite loop confirmed while
    // writing this component's own test suite, not a theoretical concern.
  }, [scriptLoaded, attempt]);

  return (
    <section className="rounded-lg border border-neutral-200 p-6 text-center">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <p className="text-base font-medium text-neutral-900">Order #{order.orderNumber}</p>
      <p className="mt-1 text-lg font-semibold text-neutral-900">
        {formatPrice(order.totalAmount)}
      </p>

      {status === "failed" ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setError(null);
              setAttempt((n) => n + 1);
            }}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Retry payment
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-600">
          {status === "verifying" ? "Confirming your payment…" : "Opening secure payment…"}
        </p>
      )}
    </section>
  );
}
