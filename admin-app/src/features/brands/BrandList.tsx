import { Fragment, useState } from "react";
import { getApiErrorEnvelope } from "@/store/api";
import { useDeleteBrandMutation, useGetBrandsQuery, useUpdateBrandStatusMutation } from "./brandsApi";
import type { BrandListItem } from "./types";

export interface BrandListProps {
  search: string;
  onSearchChange: (value: string) => void;
  onEdit: (brand: BrandListItem) => void;
}

export function BrandList({ search, onSearchChange, onEdit }: BrandListProps) {
  const { data: brands = [], isLoading } = useGetBrandsQuery(search ? { search } : undefined);
  const [deleteBrand] = useDeleteBrandMutation();
  const [updateBrandStatus] = useUpdateBrandStatusMutation();
  const [deleteGuard, setDeleteGuard] = useState<{ id: string; message: string } | null>(null);

  async function handleDelete(brand: BrandListItem) {
    setDeleteGuard(null);
    try {
      await deleteBrand(brand._id).unwrap();
    } catch (err) {
      const envelope = getApiErrorEnvelope(err);
      setDeleteGuard({ id: brand._id, message: envelope?.message ?? "Unable to delete brand." });
    }
  }

  async function handleToggleStatus(brand: BrandListItem) {
    await updateBrandStatus({ id: brand._id, status: !brand.status }).unwrap();
  }

  return (
    <section className="min-w-0 flex-1">
      <label htmlFor="brand-search" className="sr-only">
        Search brands
      </label>
      <input
        id="brand-search"
        type="text"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="h-9 w-64 rounded-md border border-neutral-300 px-3 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
      />

      {isLoading ? (
        <p className="mt-4 text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase text-neutral-500">
                <th className="px-3 py-2">Logo</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Products</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <Fragment key={brand._id}>
                  <tr className="border-b border-neutral-100">
                    <td className="px-3 py-2">
                      {brand.logo ? (
                        <img
                          src={brand.logo.url}
                          alt={brand.logo.alt ?? ""}
                          className="h-8 w-16 rounded-md border border-neutral-200 object-cover"
                        />
                      ) : (
                        <span className="block h-8 w-16 rounded-md border border-neutral-200 bg-neutral-50" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-neutral-900">{brand.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brand.productCount}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(brand)}
                        className={
                          brand.status
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                            : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500"
                        }
                      >
                        {brand.status ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onEdit(brand)}
                        className="mr-3 text-primary-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(brand)}
                        className="text-primary-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {deleteGuard?.id === brand._id && (
                    <tr>
                      <td colSpan={5} className="px-3 py-2">
                        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                          {deleteGuard.message}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {brands.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-neutral-500">
                    No brands found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
