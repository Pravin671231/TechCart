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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Sign in to your account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Welcome to TechCart
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-gray-300 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sign in with Google</h3>
            <GoogleSignIn />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-50 px-2 text-gray-500">Or sign in with email</span>
            </div>
          </div>

          <div className="rounded-md border border-gray-300 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sign in with OTP</h3>
            <OtpSignIn />
          </div>
        </div>
      </div>
    </div>
  );
}
