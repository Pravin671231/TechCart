import { useState, type FormEvent } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { Button } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyRow, Table, TableHeadRow } from "@/components/ui/Table";
import { TextField } from "@/components/form/FormField";
import { useCreateWarehouseMutation, useGetWarehousesQuery } from "./inventoryApi";

// Issue #191/M10.3 — a small, fixed set of 2-3 warehouses (FR-INV-001):
// list + create only, no edit/delete, matching the backend's own scope.
export const WarehousesPage = () => {
  const { data: warehouses, isLoading } = useGetWarehousesQuery();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [createWarehouse, { isLoading: isCreating, error: createError }] =
    useCreateWarehouseMutation();
  const saveError = getApiErrorEnvelope(createError);

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
    <main className="p-6">
      <PageHeader title="Warehouses" />

      <div className="flex flex-col gap-6 xl:flex-row">
        <section className="min-w-0 flex-1">
          {isLoading ? (
            <LoadingState />
          ) : (
            <Table minWidthClassName="min-w-[420px]">
              <TableHeadRow>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Status</th>
              </TableHeadRow>
              <tbody>
                {(warehouses ?? []).map((warehouse) => (
                  <tr key={warehouse._id} className="border-b border-neutral-100">
                    <td className="px-3 py-2 font-medium text-neutral-900">{warehouse.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-600">
                      {warehouse.code}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={warehouse.active ? "success" : "neutral"} shape="pill">
                        {warehouse.active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
                {(warehouses ?? []).length === 0 && (
                  <EmptyRow colSpan={3} message="No warehouses found." />
                )}
              </tbody>
            </Table>
          )}
        </section>

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
