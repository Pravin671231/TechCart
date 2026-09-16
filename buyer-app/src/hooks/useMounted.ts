import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// SSR-safe "has this client-rendered yet" flag for portal-based components
// (components/ui/AlertModal.tsx, components/ui/Modal.tsx) that must defer
// rendering into document.body until after hydration. useSyncExternalStore
// (not a useEffect + setState) keeps this clear of react-hooks/set-state-in-effect
// — same rationale as ProductSpecifications.tsx's useIsWide.
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
