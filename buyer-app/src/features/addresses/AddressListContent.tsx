"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductListError } from "@/features/products/ProductListError";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { useGetAddressesQuery } from "./api";
import { AddressCard } from "./AddressCard";
import { AddressesEmpty } from "./AddressesEmpty";
import { AddressesSkeleton } from "./AddressesSkeleton";
import { AddressForm } from "./AddressForm";
import type { Address } from "./types";

type Mode = { type: "list" } | { type: "add" } | { type: "edit"; address: Address };

export function AddressListContent() {
  const router = useRouter();
  const { data: session } = useGetSessionQuery();
  const [mode, setMode] = useState<Mode>({ type: "list" });

  // Same inverted guard as CartContent/AccountContent: no session sends the
  // buyer to sign-in with a redirect back here.
  useEffect(() => {
    if (session === null) {
      router.push("/sign-in?redirect=/account/addresses");
    }
  }, [session, router]);

  const {
    data: addresses,
    isLoading,
    isError,
    refetch,
  } = useGetAddressesQuery(undefined, {
    skip: !session,
  });

  return (
    <PageContainer>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">
        Saved addresses
      </h1>

      {session === null ? null : isError ? (
        <ProductListError
          onRetry={refetch}
          message="Something went wrong loading your addresses."
        />
      ) : session === undefined || isLoading || !addresses ? (
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
    </PageContainer>
  );
}
