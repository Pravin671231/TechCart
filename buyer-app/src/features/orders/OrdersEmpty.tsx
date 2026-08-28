import Link from "next/link";

export function OrdersEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 p-16 text-center">
      <p className="text-base font-medium text-neutral-900">No orders yet</p>
      <p className="text-sm text-neutral-500">Orders you place will show up here.</p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        Start shopping
      </Link>
    </div>
  );
}
