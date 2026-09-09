"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import type { ProductSpecificationGroup } from "@/features/products/types";

// Reactive `min-width: 768px` check, SSR-safe. useSyncExternalStore (not a
// useEffect) keeps the render-time state reset below clear of
// react-hooks/set-state-in-effect. Guards mirror
// features/products/Pagination.tsx's one-off matchMedia use.
function useIsWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia("(min-width: 768px)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(min-width: 768px)").matches,
    () => false,
  );
}

export function ProductSpecifications({ groups }: { groups: ProductSpecificationGroup[] }) {
  const isWide = useIsWide();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [wasWide, setWasWide] = useState<boolean | null>(null);

  // On a breakpoint change, reset which groups are open: everything on
  // tablet/desktop, nothing on mobile. Adjusted during render (React's
  // documented pattern for deriving state from a change) rather than in an
  // effect, matching ProductGallery/ProductDetailContent in this feature.
  if (isWide !== wasWide) {
    setWasWide(isWide);
    setOpenGroups(isWide ? new Set(groups.map((g) => g.groupName)) : new Set());
  }

  if (groups.length === 0) return null;

  function toggle(groupName: string) {
    setOpenGroups((prev) => {
      if (prev.has(groupName)) {
        const next = new Set(prev);
        next.delete(groupName);
        return next;
      }
      // Tablet/desktop: groups open independently. Mobile: only one at a time.
      return isWide ? new Set(prev).add(groupName) : new Set([groupName]);
    });
  }

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-neutral-500 uppercase">
        Specifications
      </h2>
      <div className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200">
        {groups.map((group, i) => {
          const open = openGroups.has(group.groupName);
          const btnId = `spec-btn-${i}`;
          const panelId = `spec-panel-${i}`;
          return (
            <div key={group.groupName}>
              <h3>
                <button
                  type="button"
                  id={btnId}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(group.groupName)}
                  className="flex w-full items-center justify-between gap-2 bg-neutral-50 px-4 py-3 text-left text-sm font-medium text-neutral-800 transition hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 focus-visible:outline-none"
                >
                  {group.groupName}
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                aria-hidden={!open}
                className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <dl className="divide-y divide-neutral-100 px-4 text-sm">
                    {group.values.map((value) => (
                      <div key={value.name} className="flex gap-4 py-2.5">
                        <dt className="w-40 shrink-0 text-neutral-500">{value.name}</dt>
                        <dd className="text-neutral-800">
                          {value.unit ? `${value.value} ${value.unit}` : String(value.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
