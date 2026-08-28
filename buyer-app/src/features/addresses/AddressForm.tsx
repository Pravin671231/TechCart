"use client";

import { useState } from "react";
import { useAddAddressMutation, useUpdateAddressMutation } from "./api";
import type { Address, AddressInput } from "./types";
import type { NormalizedApiError } from "@/store/api";

const EMPTY_INPUT: AddressInput = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

// Add and edit share one form — no client-side validation beyond the
// browser's own `required` attribute; the server's real messages (e.g. a
// malformed pincode) are surfaced verbatim, same as ProfileForm.tsx's
// established precedent.
export function AddressForm({
  address,
  onDone,
  onCancel,
}: {
  address?: Address;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<AddressInput>(
    address
      ? {
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2 ?? "",
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        }
      : EMPTY_INPUT,
  );
  const [error, setError] = useState<string | null>(null);

  const [addAddress, { isLoading: isAdding }] = useAddAddressMutation();
  const [updateAddress, { isLoading: isUpdating }] = useUpdateAddressMutation();
  const isLoading = isAdding || isUpdating;

  function set<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // `line2` is conditionally spread, not always included — under
    // exactOptionalPropertyTypes, an explicit `line2: undefined` key doesn't
    // satisfy `AddressInput`'s `line2?: string`, matching the backend's own
    // addresses.repository.ts convention for the identical field.
    const payload: AddressInput = {
      fullName: input.fullName,
      phone: input.phone,
      line1: input.line1,
      ...(input.line2 ? { line2: input.line2 } : {}),
      city: input.city,
      state: input.state,
      pincode: input.pincode,
    };

    try {
      if (address) {
        await updateAddress({ id: address._id, input: payload }).unwrap();
      } else {
        await addAddress(payload).unwrap();
      }
      onDone();
    } catch (err) {
      const apiError = err as NormalizedApiError;
      setError(apiError?.message || "Failed to save address. Please try again.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4"
    >
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-neutral-700">
          Full name
        </label>
        <input
          id="fullName"
          required
          value={input.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          required
          value={input.phone}
          onChange={(e) => set("phone", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
        />
      </div>

      <div>
        <label htmlFor="line1" className="block text-sm font-medium text-neutral-700">
          Address line 1
        </label>
        <input
          id="line1"
          required
          value={input.line1}
          onChange={(e) => set("line1", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
        />
      </div>

      <div>
        <label htmlFor="line2" className="block text-sm font-medium text-neutral-700">
          Address line 2 (optional)
        </label>
        <input
          id="line2"
          value={input.line2 ?? ""}
          onChange={(e) => set("line2", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-neutral-700">
            City
          </label>
          <input
            id="city"
            required
            value={input.city}
            onChange={(e) => set("city", e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-neutral-700">
            State
          </label>
          <input
            id="state"
            required
            value={input.state}
            onChange={(e) => set("state", e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="pincode" className="block text-sm font-medium text-neutral-700">
          PIN code
        </label>
        <input
          id="pincode"
          required
          inputMode="numeric"
          value={input.pincode}
          onChange={(e) => set("pincode", e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isLoading ? "Saving…" : address ? "Save changes" : "Add address"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
