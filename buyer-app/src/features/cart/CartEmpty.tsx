import Link from "next/link";

export function CartEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 p-16 text-center">
      <p className="text-base font-medium text-neutral-900">Your cart is empty</p>
      <p className="text-sm text-neutral-500">Browse the catalogue and add something you like.</p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-white transition hover:brightness-95 hover:shadow-md"
      >
        Start shopping
      </Link>
    </div>
  );
}
