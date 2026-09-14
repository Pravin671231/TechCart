"use client";

import { useState } from "react";
import { ProductListError } from "@/features/products/ProductListError";
import { useGetAddressesQuery } from "./api";
import { AddressCard } from "./AddressCard";
import { AddressesEmpty } from "./AddressesEmpty";
import { AddressesSkeleton } from "./AddressesSkeleton";
import { AddressForm } from "./AddressForm";
import type { Address } from "./types";

type Mode = { type: "list" } | { type: "add" } | { type: "edit"; address: Address };

// feature/buyer-app-account-sidebar-shell — session guard moved to
// AccountShell (the (account) route group's layout); this component can now
// assume an authenticated context, and PageContainer's own <main> is dropped
// in favor of a plain div since AccountShell's content region already owns
// that scrollable-pane role (matching CategoryContent's identical fix,
// Issue #346).
export function AddressListContent() {
  const [mode, setMode] = useState<Mode>({ type: "list" });

  const { data: addresses, isLoading, isError, refetch } = useGetAddressesQuery();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">
        Saved addresses
      </h1>

      {isError ? (
        <ProductListError
          onRetry={refetch}
          message="Something went wrong loading your addresses."
        />
      ) : isLoading || !addresses ? (
        <AddressesSkeleton />
      ) : mode.type === "add" ? (
        <AddressForm
          onDone={() => setMode({ type: "list" })}
          onCancel={() => setMode({ type: "list" })}
        />
      ) : mode.type === "edit" ? (
        <AddressForm
          address={mode.address}
          onDone={() => setMode({ type: "list" })}
          onCancel={() => setMode({ type: "list" })}
        />
      ) : addresses.length === 0 ? (
        <AddressesEmpty onAdd={() => setMode({ type: "add" })} />
      ) : (
        <div className="flex flex-col gap-4">
          {addresses.map((address) => (
            <AddressCard
              key={address._id}
              address={address}
              onEdit={() => setMode({ type: "edit", address })}
            />
          ))}
          <button
            type="button"
            onClick={() => setMode({ type: "add" })}
            className="self-start rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Add a new address
          </button>
        </div>
      )}
    </div>
  );
}
