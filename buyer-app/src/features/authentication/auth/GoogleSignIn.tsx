"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { NEXT_PUBLIC_GOOGLE_CLIENT_ID } from "@/store/env";
import { useOneTapSignInMutation } from "./api";

export function GoogleSignIn() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [oneTapSignIn] = useOneTapSignInMutation();

  const handleGoogleCallback = useCallback(
    (response: { credential: string }) => {
      oneTapSignIn({ idToken: response.credential }).catch(() => {
        // error handling is done by RTK Query and displayed by parent component
      });
    },
    [oneTapSignIn]
  );

  useEffect(() => {
    if (!scriptLoaded || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
    });

    if (buttonContainerRef.current) {
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
      });
    }

    window.google.accounts.id.prompt();
  }, [scriptLoaded, handleGoogleCallback]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={buttonContainerRef} className="flex justify-center" />
    </>
  );
}
