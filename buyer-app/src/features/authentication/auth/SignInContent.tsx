"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useGetSessionQuery } from "./api";
import { GoogleSignIn } from "./GoogleSignIn";
import { OtpSignIn } from "./OtpSignIn";

// Only same-origin relative paths are honoured — a `//host` or absolute URL
// falls back to home, so `?redirect=` can't be used as an open-redirect.
function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

const WELCOME_POINTS = [
  "Cart saved across every device",
  "Order history & live status",
  "Saved addresses for 1-tap checkout",
];

export function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"));
  const { data: session } = useGetSessionQuery();

  useEffect(() => {
    if (session) {
      router.push(redirectTo);
    }
  }, [session, router, redirectTo]);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Welcome panel — desktop only (Issue #344). */}
      <aside className="signin-welcome signin-enter relative hidden shrink-0 flex-col justify-between overflow-hidden p-10 text-white lg:flex lg:w-[44%]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary-300/50 blur-[60px]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary-900/60 blur-[60px]"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 200 200"
          fill="none"
          stroke="#fff"
          strokeWidth={4}
          className="pointer-events-none absolute -right-4 -bottom-4 h-56 w-56 opacity-[0.14]"
        >
          <path d="M46 66h108l9 108a10 10 0 0 1-10 11H47a10 10 0 0 1-10-11z" />
          <path d="M68 66V48a32 32 0 0 1 64 0v18" />
        </svg>

        <div className="relative flex items-center gap-2">
          <img src="/techcart-cart.svg" alt="" aria-hidden="true" className="h-7 w-7" />
          <span className="font-display text-lg font-extrabold tracking-tight">
            Tech<span className="text-primary-200">Cart</span>
          </span>
        </div>

        <div className="relative">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">
            Welcome to TechCart
          </h2>
          <p className="mt-3 max-w-sm text-sm/relaxed text-white/85">
            Sign in to track orders, keep your cart between visits, and check out faster next time.
          </p>
        </div>

        <ul className="relative space-y-2.5 text-sm text-white/90">
          {WELCOME_POINTS.map((point) => (
            <li key={point} className="flex items-center gap-2.5">
              <CheckCircle2 size={16} aria-hidden="true" className="shrink-0 text-white/80" />
              {point}
            </li>
          ))}
        </ul>
      </aside>

      {/* Form panel — full width on tablet/mobile, scrolls internally on short viewports. */}
      <main className="flex flex-1 items-center justify-center overflow-y-auto bg-white p-6 sm:p-10 ">
        <div className="signin-enter signin-enter-2 w-full max-w-sm">
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            Sign in to your account
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">Welcome to TechCart</p>

          <div className="mt-8 space-y-6">
            <div className="flex justify-center">
              <GoogleSignIn />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs font-medium tracking-wide text-neutral-400 uppercase">
                  or
                </span>
              </div>
            </div>

            <OtpSignIn />
          </div>
        </div>
      </main>
    </div>
  );
}
