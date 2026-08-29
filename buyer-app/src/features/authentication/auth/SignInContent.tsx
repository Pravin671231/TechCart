"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGetSessionQuery } from "./api";
import { GoogleSignIn } from "./GoogleSignIn";
import { OtpSignIn } from "./OtpSignIn";

// Only same-origin relative paths are honoured — a `//host` or absolute URL
// falls back to home, so `?redirect=` can't be used as an open-redirect.
function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

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
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-center font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Sign in to your account
        </h1>
        <p className="mt-2 text-center text-sm text-neutral-500">Welcome to TechCart</p>

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
    </div>
  );
}
