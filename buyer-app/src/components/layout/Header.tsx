import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <svg
            className="h-5 w-5 text-accent-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
            <path d="M2.5 3.5h2.4l2.7 12.5h9.7l2.2-8.5H6" />
          </svg>
          <span className="text-base font-extrabold tracking-tight text-neutral-900">
            Tech<span className="text-primary-600">Cart</span>
          </span>
        </Link>

        <Link
          href="/search"
          className="flex h-10 flex-1 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-400 hover:border-primary-600 hover:text-neutral-500"
        >
          Search products…
        </Link>
      </div>
    </header>
  );
}
