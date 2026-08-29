"use client";

import { useCallback, useEffect, useRef } from "react";

// Issue #326 — drives infinite-scroll listings (home, category). Returns a
// callback ref to attach to a sentinel element at the end of the list; when
// that element is in view and there is another page to load and no request
// is already in flight, `onLoadMore` fires.
export function useInfiniteScrollSentinel({
  hasNextPage,
  isFetching,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
}): (element: HTMLElement | null) => void {
  const elementRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Latest values without re-creating the observer every render.
  const stateRef = useRef({ hasNextPage, isFetching, onLoadMore });
  stateRef.current = { hasNextPage, isFetching, onLoadMore };

  // Set the instant we ask for a page and held until that fetch settles —
  // guards the window between `onLoadMore()` and `isFetching` flipping true,
  // so a burst of intersection events can't skip pages.
  const pendingRef = useRef(false);

  const maybeLoadMore = useCallback(() => {
    const { hasNextPage: canLoad, isFetching: busy, onLoadMore: load } = stateRef.current;
    if (!canLoad || busy || pendingRef.current) return;
    pendingRef.current = true;
    load();
  }, []);

  const observe = useCallback(() => {
    observerRef.current?.disconnect();
    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) maybeLoadMore();
      },
      { rootMargin: "400px" },
    );
    observerRef.current.observe(element);
  }, [maybeLoadMore]);

  const setSentinel = useCallback(
    (element: HTMLElement | null) => {
      elementRef.current = element;
      observe();
    },
    [observe],
  );

  // A fetch cycle finishing clears the guard; while one runs, keep it held.
  useEffect(() => {
    pendingRef.current = isFetching;
  }, [isFetching]);

  // When a page finishes loading the sentinel may still be on-screen (a tall
  // viewport, a short page). Re-observing makes the browser re-evaluate
  // intersection and fire again if it's still visible, so loading continues
  // without needing a fresh scroll.
  useEffect(() => {
    if (!isFetching && hasNextPage) observe();
  }, [isFetching, hasNextPage, observe]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return setSentinel;
}
