import { useState } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { AlertModal } from "@/components/ui/AlertModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useListQueryState } from "@/hooks/useListQueryState";
import {
  useDeleteBrandMutation,
  useGetBrandsQuery,
  useUpdateBrandStatusMutation,
} from "./brandsApi";
import type { BrandListItem } from "./types";

export interface BrandListProps {
  onEdit: (brand: BrandListItem) => void;
}

export const BrandList = ({ onEdit }: BrandListProps) => {
  const { filters, setFilter, page, setPage, limit, setLimit } = useListQueryState<{
    search: string;
  }>({ search: "" });

  const { data, isLoading, isFetching, isError, refetch } = useGetBrandsQuery({
    search: filters.search || undefined,
    page,
    limit,
  });
  const [deleteBrand, { isLoading: isDeleting }] = useDeleteBrandMutation();
  const [updateBrandStatus] = useUpdateBrandStatusMutation();
  const [pendingDelete, setPendingDelete] = useState<BrandListItem | null>(null);
  const [guardMessage, setGuardMessage] = useState<string | null>(null);

  async function handleDelete(brand: BrandListItem) {
    try {
      await deleteBrand(brand._id).unwrap();
    } catch (err) {
      const envelope = getApiErrorEnvelope(err);
      setGuardMessage(envelope?.message ?? "Unable to delete brand.");
    }
  }

  async function handleToggleStatus(brand: BrandListItem) {
    await updateBrandStatus({ id: brand._id, status: !brand.status }).unwrap();
  }

  const columns: DataTableColumn<BrandListItem>[] = [
    {
      id: "logo",
      header: "Logo",
      width: "5rem",
      cell: (brand) =>
        brand.logo ? (
          <img
            src={brand.logo.url}
            alt={brand.logo.alt ?? ""}
            className="h-8 w-16 rounded-md border border-neutral-200 object-cover"
          />
        ) : (
          <span className="block h-8 w-16 rounded-md border border-neutral-200 bg-neutral-50" />
        ),
    },
    {
      id: "name",
      header: "Name",
      cell: (brand) => <span className="font-medium text-neutral-900">{brand.name}</span>,
    },
    {
      id: "productCount",
      header: "Products",
      align: "right",
      cell: (brand) => <span className="tabular-nums">{brand.productCount}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (brand) => (
        <StatusBadge
          tone={brand.status ? "success" : "neutral"}
          shape="pill"
          onClick={() => void handleToggleStatus(brand)}
        >
          {brand.status ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (brand) => (
        <span className="flex gap-3">
          <button
            type="button"
            onClick={() => onEdit(brand)}
            className="text-primary-600 hover:underline"
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
        </span>
      ),
    },
  ];

  const brands = data?.items ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <>
      <DataTable<BrandListItem>
        className="min-h-0 flex-1"
        columns={columns}
        rows={brands}
        getRowId={(brand) => brand._id}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        onRetry={refetch}
        emptyMessage="No brands found."
        caption="Brand list"
        minWidth="34rem"
        search={{
          label: "Search brands",
          placeholder: "Search by name…",
          defaultValue: filters.search,
          onSearch: (value) => setFilter("search", value),
        }}
        pagination={{ page, pageSize: limit, total }}
        onPaginationChange={({ page: nextPage, pageSize }) => {
          if (pageSize !== limit) setLimit(pageSize);
          else setPage(nextPage);
        }}
      />

      <AlertModal
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

      <AlertModal
        open={Boolean(guardMessage)}
        variant="warning"
        title="Cannot delete brand"
        message={guardMessage}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setGuardMessage(null)}
        onConfirm={() => setGuardMessage(null)}
      />
    </>
  );
};
