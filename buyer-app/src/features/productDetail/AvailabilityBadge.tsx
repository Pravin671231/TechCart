import type { ProductAvailability } from "@/features/products/types";

const AVAILABILITY_COPY: Record<ProductAvailability, { label: string; className: string }> = {
  in_stock: { label: "In stock", className: "bg-green-100 text-green-700" },
  out_of_stock: { label: "Out of stock", className: "bg-neutral-200 text-neutral-600" },
};

export function AvailabilityBadge({ availability }: { availability: ProductAvailability }) {
  const { label, className } = AVAILABILITY_COPY[availability];
  return (
    <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>
  );
}
