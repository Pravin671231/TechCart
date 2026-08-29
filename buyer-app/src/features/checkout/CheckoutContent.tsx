"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductListError } from "@/features/products/ProductListError";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { useGetCartQuery } from "@/features/cart/api";
import { useGetAddressesQuery } from "@/features/addresses/api";
import { AddressSelector } from "./AddressSelector";
import { OrderSummary } from "./OrderSummary";
import { OrderConfirmation } from "./OrderConfirmation";
import { useCreateOrderMutation } from "./api";
import type { CheckoutResponse } from "./types";
import type { NormalizedApiError } from "@/store/api";

export function CheckoutContent() {
  const router = useRouter();
  const { data: session } = useGetSessionQuery();

  // Same inverted guard as CartContent/AddressListContent.
  useEffect(() => {
    if (session === null) {
      router.push("/sign-in?redirect=/checkout");
    }
  }, [session, router]);

  const {
    data: cart,
    isLoading: isCartLoading,
    isError: isCartError,
    refetch: refetchCart,
  } = useGetCartQuery(undefined, { skip: !session });

  const {
    data: addresses,
    isLoading: isAddressesLoading,
    isError: isAddressesError,
    refetch: refetchAddresses,
  } = useGetAddressesQuery(undefined, { skip: !session });

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [hasDefaultedAddress, setHasDefaultedAddress] = useState(false);

  // Pre-select the buyer's default address once the list arrives; falls
  // back to the first saved address if none is marked default. Adjusted
  // during render (React's documented pattern for deriving state from a
  // prop change) rather than in an effect — same precedent as
  // ProductDetailContent's default-variant reset, since
  // react-hooks/set-state-in-effect rejects the effect-based version.
  if (addresses && !hasDefaultedAddress) {
    setHasDefaultedAddress(true);
    const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
    if (defaultAddress) setSelectedAddressId(defaultAddress._id);
  }

  const [createOrder, { isLoading: isPlacingOrder }] = useCreateOrderMutation();
  const [order, setOrder] = useState<CheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePlaceOrder() {
    if (!selectedAddressId) return;
    setError(null);
    try {
      const result = await createOrder({ addressId: selectedAddressId }).unwrap();
      setOrder(result);
    } catch (err) {
      const apiError = err as NormalizedApiError;
      setError(apiError?.message || "Failed to place your order. Please try again.");
    }
  }

  if (order) {
    return (
      <PageContainer>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Checkout</h1>
        <OrderConfirmation order={order} />
      </PageContainer>
    );
  }

  const isLoading = session === undefined || isCartLoading || isAddressesLoading;
  const availableCount = cart?.items.filter((line) => !line.unavailable).length ?? 0;

  return (
    <PageContainer>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Checkout</h1>

      {session === null ? null : isCartError ? (
        <ProductListError onRetry={refetchCart} message="Something went wrong loading your cart." />
      ) : isAddressesError ? (
        <ProductListError
          onRetry={refetchAddresses}
          message="Something went wrong loading your addresses."
        />
      ) : isLoading || !cart || !addresses ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <SkeletonBox className="h-64 w-full rounded-lg" />
          <SkeletonBox className="h-48 w-full rounded-lg" />
        </div>
      ) : availableCount === 0 ? (
        <p className="text-sm text-neutral-500">Your cart has no available items to check out.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <AddressSelector
            addresses={addresses}
            selectedId={selectedAddressId}
            onSelect={setSelectedAddressId}
          />

          <div className="flex flex-col gap-4">
            <OrderSummary cart={cart} />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="button"
              disabled={!selectedAddressId || isPlacingOrder}
              onClick={handlePlaceOrder}
              className="w-full rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isPlacingOrder ? "Placing order…" : "Place order"}
            </button>
            {!selectedAddressId && (
              <p className="text-center text-xs text-neutral-500">
                Select or add a shipping address to continue.
              </p>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
