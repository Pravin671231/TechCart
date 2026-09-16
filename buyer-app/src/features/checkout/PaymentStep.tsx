"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { toast } from "sonner";
import { formatPrice } from "@/features/products/money";
import { useInitiatePaymentMutation, useVerifyPaymentMutation } from "./api";
import { PaymentSuccessModal } from "./PaymentSuccessModal";
import type { CheckoutResponse } from "./types";
import type { NormalizedApiError } from "@/store/api";

type PaymentStatus = "idle" | "verifying" | "failed" | "success";

// If the Razorpay script tag neither fires onLoad nor onError (a connection
// that hangs rather than failing outright), this is the fallback that stops
// the widget from being stuck on "Opening secure payment…" forever — mirrors
// store/api.ts's REQUEST_TIMEOUT_MS precedent for "don't let this hang".
const SCRIPT_LOAD_TIMEOUT_MS = 10_000;
const SCRIPT_LOAD_ERROR_MESSAGE =
  "Unable to load the payment gateway. Please check your connection and try again.";

// FR-PAY §6 (buyer-app UI/UX) — replaces the old "payment coming soon"
// placeholder: launches the Razorpay Checkout widget using
// POST .../payment's response, verifies the widget's own success callback
// server-side, then shows PaymentSuccessModal (a brief confirmation with a
// 5s countdown before it redirects home — see that component for the
// countdown/navigation logic). A failure or dismissal returns the buyer to
// a retry state on the same order rather than forcing a fresh checkout —
// retrying re-calls POST .../payment, which the backend already mints a
// fresh Razorpay order for after a failed attempt (FR-PAY-011).
export function PaymentStep({ order }: { order: CheckoutResponse }) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<PaymentStatus>("idle");

  const [initiatePayment] = useInitiatePaymentMutation();
  const [verifyPayment] = useVerifyPaymentMutation();

  // Shared by every real failure path — the reason is surfaced as a toast
  // only, not duplicated inline next to the Retry button.
  function fail(message: string) {
    setStatus("failed");
    toast.error(message);
  }

  useEffect(() => {
    if (scriptLoaded) return;
    const timeoutId = setTimeout(() => {
      fail(SCRIPT_LOAD_ERROR_MESSAGE);
    }, SCRIPT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
    // Fresh timeout window per retry attempt; skipped entirely once the
    // script has actually loaded.
  }, [scriptLoaded, attempt]);

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
                if (!cancelled) setStatus("success");
              })
              .catch((err: unknown) => {
                if (cancelled) return;
                const apiError = err as NormalizedApiError;
                fail(apiError?.message || "We couldn't confirm your payment. Please try again.");
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
        fail(apiError?.message || "Unable to start payment. Please try again.");
      });

    return () => {
      cancelled = true;
    };
    // Deliberately re-runs only on scriptLoaded/attempt (attempt is the
    // retry trigger). initiatePayment/verifyPayment are omitted on purpose,
    // not an oversight — this effect originally also omitted `router` for
    // the identical reason (a test double for next/navigation's useRouter
    // that returns a fresh object per render turned it into an unstable
    // dependency and re-triggered this effect every render, a real infinite
    // loop confirmed while writing this component's own test suite);
    // PaymentSuccessModal now owns the post-success redirect, so this
    // component has no router usage left at all.
  }, [scriptLoaded, attempt]);

  return (
    <section className="rounded-lg border border-neutral-200 p-6 text-center">
      <Script
        key={attempt}
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => fail(SCRIPT_LOAD_ERROR_MESSAGE)}
      />

      <p className="text-base font-medium text-neutral-900">Order #{order.orderNumber}</p>
      <p className="mt-1 text-lg font-semibold text-neutral-900">
        {formatPrice(order.totalAmount)}
      </p>

      {status === "failed" ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setAttempt((n) => n + 1);
            }}
            className="rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-white transition hover:brightness-95 hover:shadow-md"
          >
            Retry payment
          </button>
        </div>
      ) : status !== "success" ? (
        <p className="mt-4 text-sm text-neutral-600">
          {status === "verifying" ? "Confirming your payment…" : "Opening secure payment…"}
        </p>
      ) : null}

      {status === "success" && (
        <PaymentSuccessModal orderNumber={order.orderNumber} amount={order.totalAmount} />
      )}
    </section>
  );
}
