import { useState } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { LoadingState } from "@/components/ui/LoadingState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/form/SearchInput";
import { EmptyRow, Table, TableHeadRow } from "@/components/ui/Table";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGetInventoryQuery, useGetWarehousesQuery, useUpdateInventoryStockMutation } from "./inventoryApi";
import type { InventoryItem } from "./types";

export interface InventoryListProps {
  search: string;
  onSearchChange: (value: string) => void;
  warehouseId: string;
  onWarehouseChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
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

export const InventoryList = ({
  search,
  onSearchChange,
  warehouseId,
  onWarehouseChange,
  page,
  onPageChange,
}: InventoryListProps) => {
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data: warehouses } = useGetWarehousesQuery();
  const { data, isLoading, isFetching } = useGetInventoryQuery({
    search: debouncedSearch || undefined,
    warehouseId: warehouseId || undefined,
    page,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <section className="min-w-0 flex-1">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          id="inventory-search"
          label="Search inventory"
          placeholder="Search by product or SKU…"
          value={search}
          onChange={onSearchChange}
          width="w-80"
        />
        <label htmlFor="inventory-warehouse" className="sr-only">
          Warehouse
        </label>
        <select
          id="inventory-warehouse"
          value={warehouseId}
          onChange={(event) => onWarehouseChange(event.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-600"
        >
          <option value="">Warehouse: All</option>
          {(warehouses ?? []).map((warehouse) => (
            <option key={warehouse._id} value={warehouse._id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <Table minWidthClassName="min-w-[640px]" isFetching={isFetching}>
          <TableHeadRow variant="shaded">
            <th className="px-3 py-2 font-medium text-neutral-500">Product</th>
            <th className="px-3 py-2 font-medium text-neutral-500">SKU</th>
            <th className="px-3 py-2 font-medium text-neutral-500">Warehouse</th>
            <th className="px-3 py-2 text-right font-medium text-neutral-500">Stock</th>
          </TableHeadRow>
          <tbody className="divide-y divide-neutral-100">
            {items.map((item) => (
              <tr key={item._id}>
                <td className="px-3 py-2 font-medium text-neutral-900">{item.productName}</td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-600">{item.variantSku}</td>
                <td className="px-3 py-2">{item.warehouseName}</td>
                <td className="px-3 py-2 text-right">
                  <StockCell item={item} />
                </td>
              </tr>
            ))}
            {items.length === 0 && <EmptyRow colSpan={4} message="No inventory records found." />}
          </tbody>
        </Table>
      )}

      {pagination && <Pagination page={page} pagination={pagination} onPageChange={onPageChange} />}
    </section>
  );
};
