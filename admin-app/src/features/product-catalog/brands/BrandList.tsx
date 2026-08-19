import { Fragment, useState } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyRow, Table, TableHeadRow } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LoadingState } from "@/components/ui/LoadingState";
import { SearchInput } from "@/components/form/SearchInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useDeleteBrandMutation,
  useGetBrandsQuery,
  useUpdateBrandStatusMutation,
} from "./brandsApi";
import type { BrandListItem } from "./types";

export interface BrandListProps {
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  onEdit: (brand: BrandListItem) => void;
}

export const BrandList = ({
  search,
  onSearchChange,
  page,
  onPageChange,
  onEdit,
}: BrandListProps) => {
  const debouncedSearch = useDebouncedValue(search, 300);
  const {
    data,
    isLoading,
    isFetching,
  } = useGetBrandsQuery({ search: debouncedSearch || undefined, page });
  const brands = data?.items ?? [];
  const pagination = data?.pagination;
  const [deleteBrand, { isLoading: isDeleting }] = useDeleteBrandMutation();
  const [updateBrandStatus] = useUpdateBrandStatusMutation();
  const [deleteGuard, setDeleteGuard] = useState<{ id: string; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BrandListItem | null>(null);

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
      <SearchInput
        id="brand-search"
        label="Search brands"
        placeholder="Search by name…"
        value={search}
        onChange={onSearchChange}
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="mt-4">
          <Table minWidthClassName="min-w-[560px]" isFetching={isFetching}>
            <TableHeadRow>
              <th className="px-3 py-2">Logo</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Products</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </TableHeadRow>
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
                      <StatusBadge
                        tone={brand.status ? "success" : "neutral"}
                        shape="pill"
                        onClick={() => void handleToggleStatus(brand)}
                      >
                        {brand.status ? "Active" : "Inactive"}
                      </StatusBadge>
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
                        onClick={() => setPendingDelete(brand)}
                        className="text-primary-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {deleteGuard?.id === brand._id && (
                    <tr>
                      <td colSpan={5} className="px-3 py-2">
                        <InlineAlert>{deleteGuard.message}</InlineAlert>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {brands.length === 0 && <EmptyRow colSpan={5} message="No brands found." />}
            </tbody>
          </Table>
        </div>
      )}

      {pagination && <Pagination page={page} pagination={pagination} onPageChange={onPageChange} />}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete brand"
        message={`Delete "${pendingDelete?.name}"? This can't be undone.`}
        isConfirming={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) void handleDelete(target);
        }}
      />
    </section>
  );
};
