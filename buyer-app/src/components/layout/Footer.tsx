import Link from "next/link";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/" },
  { label: "Categories", href: "#" },
  { label: "Offers", href: "#" },
];

const CUSTOMER_SERVICE_LINKS = [
  { label: "Contact Us", href: "#" },
  { label: "FAQ", href: "#" },
  { label: "Shipping Information", href: "#" },
  { label: "Returns & Refunds", href: "#" },
];

const SOCIAL_LINKS = ["FB", "IG", "X", "YT"];

const PAYMENT_METHODS = ["Visa", "MasterCard", "PayPal", "UPI"];

export function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-900 text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-accent-500"
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
              <span className="text-base font-extrabold tracking-tight text-white">
                Tech<span className="text-primary-400">Cart</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-400">
              India-first electronics and accessories, at prices that make sense.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-white uppercase">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              {QUICK_LINKS.map((link) =>
                link.href === "#" ? (
                  <li key={link.label}>
                    <a className="hover:text-primary-400" href={link.href}>
                      {link.label}
                    </a>
                  </li>
                ) : (
                  <li key={link.label}>
                    <Link className="hover:text-primary-400" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-white uppercase">
              Customer Service
            </h3>
            <ul className="space-y-2 text-sm">
              {CUSTOMER_SERVICE_LINKS.map((link) => (
                <li key={link.label}>
                  <a className="hover:text-primary-400" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-white uppercase">
              Follow Us
            </h3>
            <div className="flex gap-2">
              {SOCIAL_LINKS.map((label) => (
                <a
                  key={label}
                  href="#"
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-800 text-[11px] font-medium hover:bg-primary-600 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-white uppercase">
              We Accept
            </h3>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <span
                  key={method}
                  className="rounded-md bg-neutral-800 px-2.5 py-1 text-[11px] font-medium"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-neutral-800 pt-6 text-xs text-neutral-500 sm:flex-row">
          <p>© 2026 TechCart. All rights reserved.</p>
          <div className="flex gap-4">
            <a className="hover:text-primary-400" href="#">
              Privacy Policy
            </a>
            <a className="hover:text-primary-400" href="#">
              Terms &amp; Conditions
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
