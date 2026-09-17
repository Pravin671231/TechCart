"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { toast } from "sonner";
import { formatPrice } from "@/features/products/money";
import { useInitiatePaymentMutation, useVerifyPaymentMutation } from "./api";
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
// server-side, then surfaces a success toast. `redirectOnSuccess` (default
// true) sends the buyer home immediately afterwards — the fresh-checkout
// flow (OrderConfirmation.tsx) wants that; the order-detail "Pay now" retry
// (OrderDetailContent.tsx) passes `redirectOnSuccess={false}` plus
// `onSuccess` instead, staying on the order page, which already leaves this
// component's rendered state once the order data refreshes to a non-
// pending-payment status. A failure or dismissal returns the buyer to a
// retry state on the same order rather than forcing a fresh checkout —
// retrying re-calls POST .../payment, which the backend already mints a
// fresh Razorpay order for after a failed attempt (FR-PAY-011).
export function PaymentStep({
  order,
  redirectOnSuccess = true,
  onSuccess,
}: {
  order: CheckoutResponse;
  redirectOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
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
        // ORDER_ALREADY_PAID (bug fix, no issue number) — this order is
        // actually already done (e.g. a stale "failed" state from an
        // earlier verifyPayment race, now fixed at its source), not a real
        // failure; recover into the success state instead of dead-ending
        // the buyer on a Retry loop that will only ever reject again.
        if (apiError?.code === "ORDER_ALREADY_PAID") {
          setStatus("success");
          return;
        }
        fail(apiError?.message || "Unable to start payment. Please try again.");
      });

    return () => {
      cancelled = true;
    };
    // Deliberately re-runs only on scriptLoaded/attempt (attempt is the
    // retry trigger). initiatePayment/verifyPayment/router are omitted on
    // purpose, not an oversight — a test double for next/navigation's
    // useRouter returns a fresh object per render, which would otherwise
    // turn `router` into an unstable dependency and re-trigger this effect
    // every render (a real infinite loop confirmed while writing this
    // component's own test suite). The success/redirect effect below reads
    // `router` too, but keys off `status` instead, so it doesn't have this
    // problem.
  }, [scriptLoaded, attempt]);

  useEffect(() => {
    if (status !== "success") return;
    toast.success("Payment successful!");
    if (redirectOnSuccess) {
      router.push("/");
    } else {
      onSuccess?.();
    }
    // router/onSuccess/redirectOnSuccess deliberately omitted — this must
    // fire exactly once per success transition, not on every unrelated
    // re-render of an unstable `router`/`onSuccess` reference (see the
    // main payment effect above for the identical reasoning).
  }, [status]);

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
    </section>
  );
}
