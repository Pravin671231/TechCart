"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { NEXT_PUBLIC_GOOGLE_CLIENT_ID } from "@/store/env";
import { useGetSessionQuery, useOneTapSignInMutation } from "./api";

export function GoogleSignIn() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const promptedRef = useRef(false);

  const [oneTapSignIn] = useOneTapSignInMutation();
  const { data: session, isLoading: sessionLoading } = useGetSessionQuery();

  // Initialise the GSI client + render the button exactly once. Guarded by a
  // ref so React StrictMode's double-invoked effect (and any re-render) can't
  // re-run `initialize`/`renderButton` — doing so makes the GSI client log a
  // `console.error` and can append a duplicate button. `oneTapSignIn` is a
  // referentially stable RTK Query trigger, so listing it in deps is safe.
  useEffect(() => {
    if (!scriptLoaded || !window.google || initializedRef.current) return;
    initializedRef.current = true;

    window.google.accounts.id.initialize({
      client_id: NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: (response) => {
        oneTapSignIn({ idToken: response.credential }).catch(() => {
          // error handling is done by RTK Query and displayed by the parent
        });
      },
    });

    if (buttonContainerRef.current && buttonContainerRef.current.childElementCount === 0) {
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
      });
    }
  }, [scriptLoaded, oneTapSignIn]);

  // One Tap: prompt at most once, and only for a signed-out visitor. The
  // session query resolves asynchronously (usually after StrictMode's
  // double-invoke has settled), so this fires a single `prompt()`.
  useEffect(() => {
    if (!scriptLoaded || !window.google || !initializedRef.current) return;
    if (sessionLoading || session || promptedRef.current) return;
    promptedRef.current = true;
    window.google.accounts.id.prompt();
  }, [scriptLoaded, sessionLoading, session]);

  // Dismiss any pending One Tap prompt when leaving the page.
  useEffect(() => {
    return () => {
      window.google?.accounts.id.cancel();
    };
  }, []);

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
