import { useMemo, useState, type FormEvent } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { Button } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField } from "@/components/form/FormField";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { useCreateWarehouseMutation, useGetWarehousesQuery } from "./inventoryApi";
import type { Warehouse } from "./types";

// Issue #191/M10.3 — a small, fixed set of 2-3 warehouses (FR-INV-001):
// list + create only, no edit/delete, matching the backend's own scope.
export const WarehousesPage = () => {
  const { data: warehouses, isLoading, isFetching, isError, refetch } = useGetWarehousesQuery();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [createWarehouse, { isLoading: isCreating, error: createError }] =
    useCreateWarehouseMutation();
  const saveError = getApiErrorEnvelope(createError);

  const columns = useMemo<DataTableColumn<Warehouse>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (warehouse) => (
          <span className="font-medium text-neutral-900">{warehouse.name}</span>
        ),
      },
      {
        id: "code",
        header: "Code",
        cell: (warehouse) => (
          <span className="font-mono text-xs text-neutral-600">{warehouse.code}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (warehouse) => (
          <StatusBadge tone={warehouse.active ? "success" : "neutral"} shape="pill">
            {warehouse.active ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
    ],
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!trimmedName || !trimmedCode) return;

    try {
      await createWarehouse({ name: trimmedName, code: trimmedCode }).unwrap();
      setName("");
      setCode("");
    } catch {
      // surfaced via saveError below
    }
  }

  return (
    <main className="flex h-full min-h-0 flex-col p-6">
      <PageHeader title="Warehouses" />

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
        <DataTable<Warehouse>
          className="min-h-0 flex-1"
          columns={columns}
          rows={warehouses ?? []}
          getRowId={(warehouse) => warehouse._id}
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          onRetry={refetch}
          emptyMessage="No warehouses found."
          caption="Warehouse list"
          minWidth="24rem"
        />

        <Card className="w-full shrink-0 xl:w-96">
          <CardHeading>New warehouse</CardHeading>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              id="warehouse-name"
              label="Name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <TextField
              id="warehouse-code"
              label="Code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />

            {saveError && (
              <p role="alert" className="text-[11px] text-red-600">
                {saveError.message ?? "Unable to create warehouse."}
              </p>
            )}

            <Button type="submit" loading={isCreating} loadingLabel="Creating…">
              Create
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
};
