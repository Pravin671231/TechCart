import Link from "next/link";
import { formatPrice } from "@/features/products/money";
import { DroppedItemsNotice } from "./DroppedItemsNotice";
import type { CheckoutResponse } from "./types";

export function OrderConfirmation({ order }: { order: CheckoutResponse }) {
  return (
    <div className="flex flex-col gap-4">
      {order.droppedItems && order.droppedItems.length > 0 && (
        <DroppedItemsNotice items={order.droppedItems} />
      )}

      <section className="rounded-lg border border-neutral-200 p-6 text-center">
        <p className="text-base font-medium text-neutral-900">Order placed</p>
        <p className="mt-1 text-sm text-neutral-500">Order #{order.orderNumber}</p>
        <p className="mt-4 text-sm text-neutral-600">
          Payment is coming soon — we&apos;ll notify you once it&apos;s ready.
        </p>
        <p className="mt-1 text-lg font-semibold text-neutral-900">
          {formatPrice(order.totalAmount)}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/orders/${order.id}`}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            View order
          </Link>
          <Link
            href="/"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Continue shopping
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">Items</h2>
        <ul className="mt-4 flex flex-col gap-3 text-sm">
          {order.items.map((item) => (
            <li key={item.variant.id} className="flex justify-between gap-3">
              <span className="text-neutral-700">
                {item.product.name} × {item.quantity}
              </span>
              <span className="shrink-0 font-medium text-neutral-900">
                {formatPrice(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
