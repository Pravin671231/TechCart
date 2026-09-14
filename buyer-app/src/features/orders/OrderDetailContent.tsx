"use client";

import { toast } from "sonner";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { ProductListError } from "@/features/products/ProductListError";
import { formatPrice } from "@/features/products/money";
import { showApiErrorToast } from "@/lib/apiErrorToast";
import { useCancelOrderMutation, useGetOrderQuery } from "./api";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderStatusTimeline } from "./OrderStatusTimeline";
import { CANCELLABLE_STATUSES } from "./types";
import type { NormalizedApiError } from "@/store/api";

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

  async function handleCancel() {
    try {
      await cancelOrder({ id }).unwrap();
      toast.success("Order cancelled");
    } catch (err) {
      showApiErrorToast(err, "Failed to cancel this order. Please try again.");
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
            <ul className="mt-4 flex flex-col gap-3 text-sm">
              {order.items.map((item) => (
                <li key={item.variant.id} className="flex justify-between gap-3">
                  <span className="text-neutral-700">
                    {item.product.name}
                    {item.variant.attributes.length > 0 && (
                      <span className="text-neutral-500">
                        {" "}
                        ({item.variant.attributes.map((a) => `${a.name}: ${a.value}`).join(", ")})
                      </span>
                    )}{" "}
                    × {item.quantity}
                  </span>
                  <span className="shrink-0 font-medium text-neutral-900">
                    {formatPrice(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
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
                onClick={handleCancel}
                className="w-full rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling…" : "Cancel order"}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
