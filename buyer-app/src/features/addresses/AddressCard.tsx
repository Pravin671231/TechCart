"use client";

import { useDeleteAddressMutation, useSetDefaultAddressMutation } from "./api";
import type { Address } from "./types";

export function AddressCard({ address, onEdit }: { address: Address; onEdit: () => void }) {
  const [deleteAddress, { isLoading: isDeleting }] = useDeleteAddressMutation();
  const [setDefaultAddress, { isLoading: isSettingDefault }] = useSetDefaultAddressMutation();

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-neutral-900">
          {address.fullName}
          {address.isDefault && (
            <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
              Default
            </span>
          )}
        </p>
      </div>
      <p className="text-sm text-neutral-600">
        {address.line1}
        {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state}{" "}
        {address.pincode}
      </p>
      <p className="text-sm text-neutral-500">{address.phone}</p>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => deleteAddress({ id: address._id })}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          Delete
        </button>
        {!address.isDefault && (
          <button
            type="button"
            disabled={isSettingDefault}
            onClick={() => setDefaultAddress({ id: address._id })}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Set as default
          </button>
        )}
      </div>
    </div>
  );
}
