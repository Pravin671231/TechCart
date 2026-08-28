import { formatPrice } from "@/features/products/money";
import { DroppedItemsNotice } from "./DroppedItemsNotice";
import { PaymentStep } from "./PaymentStep";
import type { CheckoutResponse } from "./types";

export function OrderConfirmation({ order }: { order: CheckoutResponse }) {
  return (
    <div className="flex flex-col gap-4">
      {order.droppedItems && order.droppedItems.length > 0 && (
        <DroppedItemsNotice items={order.droppedItems} />
      )}

      <PaymentStep order={order} />

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
