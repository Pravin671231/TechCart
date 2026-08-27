"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductListError } from "@/features/products/ProductListError";
import { useGetSessionQuery } from "@/features/authentication/auth/api";
import { useGetCartQuery } from "./api";
import { CartEmpty } from "./CartEmpty";
import { CartLineRow } from "./CartLineRow";
import { CartSkeleton } from "./CartSkeleton";
import { CartSummary } from "./CartSummary";

export function CartContent() {
  const router = useRouter();
  const { data: session } = useGetSessionQuery();

  // The inverse of SignInContent's redirect: no session sends the buyer to
  // sign-in (with a redirect back here), never to the cart (FR-CART-019).
  useEffect(() => {
    if (session === null) {
      router.push("/sign-in?redirect=/cart");
    }
  }, [session, router]);

  const {
    data: cart,
    isLoading,
    isError,
    refetch,
  } = useGetCartQuery(undefined, {
    skip: !session,
  });

  return (
    <PageContainer>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Your cart</h1>

      {session === null ? null : isError ? (
        <ProductListError onRetry={refetch} message="Something went wrong loading your cart." />
      ) : session === undefined || isLoading || !cart ? (
        <CartSkeleton />
      ) : cart.items.length === 0 ? (
        <CartEmpty />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-4">
            {cart.items.map((line) => (
              <CartLineRow key={line.variant.id} line={line} />
            ))}
          </div>
          <CartSummary cart={cart} />
        </div>
      )}
    </PageContainer>
  );
}
