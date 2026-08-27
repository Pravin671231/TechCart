import { Suspense } from "react";
import { SignInContent } from "@/features/authentication/auth/SignInContent";

export const metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  // SignInContent reads `?redirect=` via useSearchParams, which requires a
  // Suspense boundary in this Next version.
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
