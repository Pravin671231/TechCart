/**
 * Issue #322 — the TechCart brand lockup: the supplied cart mark
 * (`/public/techcart-cart.svg`) plus the "Tech" (ink) / "Cart" (primary)
 * wordmark. `variant="dark"` recolours the wordmark for the dark footer;
 * the cart mark is a fixed multi-tone asset and never recoloured, matching
 * the brand kit (`mock-ui/brand-kit.html`).
 */
export function Logo({ variant = "light" }: { variant?: "light" | "dark" }) {
  const techColor = variant === "dark" ? "text-white" : "text-neutral-900";
  const cartWordColor = variant === "dark" ? "text-primary-400" : "text-primary-600";

  return (
    <span className="flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static inline-art logo, no optimization needed */}
      <div className="flex h-8 w-auto shrink-0 items-center pe-2 rounded-md bg-white ">
        <img src="/techcart-cart.svg" alt="" aria-hidden="true" className="h-7 w-7 shrink-0" />
      <span className={`text-base font-extrabold tracking-tight ${techColor}`}>
        Tech<span className={cartWordColor}>Cart</span>
      </span>
      </div>
    </span>
  );
}
