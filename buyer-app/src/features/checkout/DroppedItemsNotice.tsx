import type { DroppedItem } from "./types";

// FR-ORD-025 — rendered first, above the rest of the confirmation content,
// so a buyer sees which items were dropped before anything else on the
// result screen.
export function DroppedItemsNotice({ items }: { items: DroppedItem[] }) {
  return (
    <div className="rounded-md border border-accent-300 bg-accent-50 p-4 text-sm text-accent-800">
      <p className="font-medium">Some items were removed from your order</p>
      <p className="mt-1 text-accent-700">
        These became unavailable between adding them to your cart and placing this order:
      </p>
      <ul className="mt-2 list-inside list-disc">
        {items.map((item) => (
          <li key={item.sku}>SKU {item.sku}</li>
        ))}
      </ul>
    </div>
  );
}
