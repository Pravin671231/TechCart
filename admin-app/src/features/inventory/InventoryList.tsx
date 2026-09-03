import { useMemo, useState } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { useListQueryState } from "@/hooks/useListQueryState";
import {
  useGetInventoryQuery,
  useGetWarehousesQuery,
  useUpdateInventoryStockMutation,
} from "./inventoryApi";
import type { InventoryItem } from "./types";

interface InventoryFilters {
  search: string;
  warehouseId: string;
}

interface StockCellProps {
  item: InventoryItem;
}

// Issue #191/M10.3 — click the stock cell -> numeric input + Save, mirroring
// the pre-#102 stock quick-editor precedent documented in this app's own
// AGENTS.md. NEGATIVE_STOCK_REJECTED is surfaced inline, right under the
// input, without navigating away.
const StockCell = ({ item }: StockCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(item.stock));
  const [updateStock, { isLoading }] = useUpdateInventoryStockMutation();
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(String(item.stock));
    setError(null);
    setIsEditing(true);
  }

  function cancel() {
    setIsEditing(false);
    setError(null);
  }

  async function save() {
    const parsed = Number(draft);
    if (!Number.isInteger(parsed)) {
      setError("Enter a whole number.");
      return;
    }
    try {
      await updateStock({ id: item._id, stock: parsed }).unwrap();
      setIsEditing(false);
      setError(null);
    } catch (err) {
      const envelope = getApiErrorEnvelope(err);
      setError(envelope?.message ?? "Unable to update stock.");
    }
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="rounded-md px-2 py-1 text-right tabular-nums hover:bg-neutral-100"
      >
        {item.stock}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <label htmlFor={`stock-${item._id}`} className="sr-only">
          Stock for {item.productName} ({item.variantSku})
        </label>
        <input
          id={`stock-${item._id}`}
          type="number"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm"
          autoFocus
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={isLoading}
          className="rounded-md bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export const InventoryList = () => {
  const { filters, setFilter, page, setPage, limit, setLimit } =
    useListQueryState<InventoryFilters>({ search: "", warehouseId: "" });

  const { data: warehouses } = useGetWarehousesQuery();
  const { data, isLoading, isFetching, isError, refetch } = useGetInventoryQuery({
    search: filters.search || undefined,
    warehouseId: filters.warehouseId || undefined,
    page,
    limit,
  });

  const columns = useMemo<DataTableColumn<InventoryItem>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        cell: (item) => <span className="font-medium text-neutral-900">{item.productName}</span>,
      },
      {
        id: "sku",
        header: "SKU",
        cell: (item) => <span className="font-mono text-xs text-neutral-600">{item.variantSku}</span>,
      },
      {
        id: "warehouse",
        header: "Warehouse",
        cell: (item) => item.warehouseName,
      },
      {
        id: "stock",
        header: "Stock",
        align: "right",
        cell: (item) => <StockCell item={item} />,
      },
    ],
    [],
  );

  const warehouseOptions = (warehouses ?? []).map((warehouse) => ({
    label: warehouse.name,
    value: warehouse._id,
  }));

  const items = data?.items ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <DataTable<InventoryItem>
      className="mt-4 min-h-0 flex-1"
      columns={columns}
      rows={items}
      getRowId={(item) => item._id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      onRetry={refetch}
      emptyMessage="No inventory records found."
      caption="Inventory list"
      minWidth="40rem"
      search={{
        label: "Search inventory",
        placeholder: "Search by product or SKU…",
        defaultValue: filters.search,
        onSearch: (value) => setFilter("search", value),
      }}
      filters={{
        fields: [
          {
            type: "select",
            key: "warehouseId",
            label: "Warehouse",
            placeholder: "Warehouse: All",
            options: warehouseOptions,
          },
        ],
        values: { warehouseId: filters.warehouseId },
        onChange: (_key, value) => setFilter("warehouseId", value),
      }}
      pagination={{ page, pageSize: limit, total }}
      onPaginationChange={({ page: nextPage, pageSize }) => {
        if (pageSize !== limit) setLimit(pageSize);
        else setPage(nextPage);
      }}
    />
  );
};
