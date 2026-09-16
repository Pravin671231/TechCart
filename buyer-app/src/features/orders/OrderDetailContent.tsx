"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertModal } from "@/components/ui/AlertModal";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { useAddCartItemMutation } from "@/features/cart/api";
import { PaymentStep } from "@/features/checkout/PaymentStep";
import { ProductListError } from "@/features/products/ProductListError";
import { formatPrice } from "@/features/products/money";
import { showApiErrorToast } from "@/lib/apiErrorToast";
import { useCancelOrderMutation, useGetOrderQuery } from "./api";
import { OrderItemRow } from "./OrderItemRow";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderStatusTimeline } from "./OrderStatusTimeline";
import { CANCELLABLE_STATUSES } from "./types";
import type { NormalizedApiError } from "@/store/api";

type ConfirmAction = "pay" | "moveToCart" | "cancel" | null;

// feature/buyer-app-account-sidebar-shell — session guard moved to
// AccountShell; PageContainer's own <main> dropped for a plain div (see
// AddressListContent.tsx's identical note).
export function OrderDetailContent({ id }: { id: string }) {
  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetOrderQuery(id);
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();
  const [addCartItem] = useAddCartItemMutation();
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [isMovingToCart, setIsMovingToCart] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  async function handleCancel() {
    try {
      await cancelOrder({ id }).unwrap();
      toast.success("Order cancelled");
    } catch (err) {
      showApiErrorToast(err, "Failed to cancel this order. Please try again.");
    }
  }

  // Best-effort and sequential (not Promise.all) — a buyer's cart is one
  // document, so concurrent adds would race each other. Stops on the first
  // failure and leaves the order untouched (not cancelled), so retrying is
  // clean rather than needing compensating rollback logic. Stays on this
  // page on success — no /cart redirect — so the confirming AlertModal's
  // outcome is visible without navigating away.
  async function handleMoveToCart() {
    if (!order) return;
    setIsMovingToCart(true);
    try {
      for (const item of order.items) {
        await addCartItem({ variantId: item.variant.id, quantity: item.quantity }).unwrap();
      }
      await cancelOrder({ id }).unwrap();
      toast.success("Items added to your cart");
    } catch (err) {
      showApiErrorToast(err, "Couldn't move these items to your cart. Please try again.");
    } finally {
      setIsMovingToCart(false);
    }
  }

  if (isError) {
    const code = (error as NormalizedApiError | undefined)?.code;
    const isNotFound = code === "ORDER_NOT_FOUND" || code === "INVALID_ID";
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        {isNotFound ? (
          <NotFoundState message="This order doesn't exist or isn't yours." />
        ) : (
          <ProductListError onRetry={refetch} message="Something went wrong loading this order." />
        )}
      </div>
    );
  }

  if (isLoading || !order) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <p className="text-sm text-neutral-500">Loading order…</p>
      </div>
    );
  }

  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const isPendingPayment = order.status === "pending_payment";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Order #{order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-neutral-200 p-5">
            <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
              Items
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {order.items.map((item) => (
                <OrderItemRow key={item.variant.id} item={item} />
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-900">
              <span>Total</span>
              <span>{formatPrice(order.totalAmount)}</span>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 p-5">
            <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
              Shipping address
            </h2>
            <p className="mt-4 text-sm text-neutral-700">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
              {order.shippingAddress.pincode}
              <br />
              {order.shippingAddress.phone}
            </p>
          </section>

          {order.cancellationReason && (
            <section className="rounded-lg border border-neutral-200 p-5">
              <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
                Cancellation reason
              </h2>
              <p className="mt-4 text-sm text-neutral-700">{order.cancellationReason}</p>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {isPendingPayment && showPaymentStep && <PaymentStep order={order} />}

          {isPendingPayment && !showPaymentStep && (
            <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-5">
              <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
                Complete your payment
              </h2>
              <button
                type="button"
                onClick={() => setConfirmAction("pay")}
                className="w-full rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-white transition hover:brightness-95 hover:shadow-md"
              >
                Pay now
              </button>
              <button
                type="button"
                disabled={isMovingToCart}
                onClick={() => setConfirmAction("moveToCart")}
                className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                {isMovingToCart ? "Moving to cart…" : "Add items to cart"}
              </button>
            </section>
          )}

          <section className="rounded-lg border border-neutral-200 p-5">
            <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
              Status
            </h2>
            <div className="mt-4">
              <OrderStatusTimeline statusHistory={order.statusHistory} />
            </div>
          </section>

          {canCancel && (
            <section className="rounded-lg border border-neutral-200 p-5">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setConfirmAction("cancel")}
                className="w-full rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling…" : "Cancel order"}
              </button>
            </section>
          )}
        </div>
      </div>

      <AlertModal
        open={confirmAction === "pay"}
        variant="confirm"
        title="Pay now?"
        message={`You're about to complete payment of ${formatPrice(order.totalAmount)} for order #${order.orderNumber}.`}
        confirmLabel="Pay now"
        onConfirm={() => {
          setConfirmAction(null);
          setShowPaymentStep(true);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <AlertModal
        open={confirmAction === "moveToCart"}
        variant="confirm"
        title="Add items to cart?"
        message="This will add every item from this order to your cart and cancel this order."
        confirmLabel="Add to cart"
        isConfirming={isMovingToCart}
        onConfirm={async () => {
          await handleMoveToCart();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <AlertModal
        open={confirmAction === "cancel"}
        variant="danger"
        title="Cancel this order?"
        message="This can't be undone. Are you sure you want to cancel this order?"
        confirmLabel="Cancel order"
        isConfirming={isCancelling}
        onConfirm={async () => {
          await handleCancel();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
