"use client";

import { useState } from "react";
import { AddressForm } from "@/features/addresses/AddressForm";
import type { Address } from "@/features/addresses/types";

export function AddressSelector({
  addresses,
  selectedId,
  onSelect,
}: {
  addresses: Address[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <section className="rounded-lg border border-neutral-200 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
        Shipping address
      </h2>

      <div className="mt-4 flex flex-col gap-3">
        {addresses.map((address) => (
          <label
            key={address._id}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
              selectedId === address._id ? "border-primary-600 bg-primary-50" : "border-neutral-200"
            }`}
          >
            <input
              type="radio"
              name="shippingAddress"
              value={address._id}
              checked={selectedId === address._id}
              onChange={() => onSelect(address._id)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-neutral-900">
                {address.fullName}
                {address.isDefault && (
                  <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                    Default
                  </span>
                )}
              </span>
              <span className="block text-neutral-600">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state}{" "}
                {address.pincode}
              </span>
              <span className="block text-neutral-500">{address.phone}</span>
            </span>
          </label>
        ))}
      </div>

      {showAddForm ? (
        <div className="mt-4">
          <AddressForm
            onDone={(address) => {
              onSelect(address._id);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mt-4 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Add a new address
        </button>
      )}
    </section>
  );
}
