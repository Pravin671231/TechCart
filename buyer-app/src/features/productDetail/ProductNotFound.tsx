import Link from "next/link";

export function ProductNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center text-sm text-neutral-500">
      <p>This product doesn&apos;t exist or is no longer available.</p>
      <Link
        href="/"
        className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Back to home
      </Link>
    </div>
  );
}
