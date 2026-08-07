import { useState } from "react";
import { getApiErrorEnvelope } from "@/app/store/api";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ErrorState, LoadingState } from "@/components/ui/LoadingState";
import { Table, TableHeadRow } from "@/components/ui/Table";
import {
  useGetCategoryVariantsQuery,
  usePatchCategoryVariantsMutation,
  useReplaceCategoryVariantsMutation,
} from "./categoryVariantsApi";
import { VariantAxisRow } from "./VariantAxisRow";
import type { VariantAxis } from "./types";

function isAxisPersisted(persisted: VariantAxis[], code: string): boolean {
  return persisted.some((axis) => axis.code === code);
}

function nextAxisCode(existing: VariantAxis[]): string {
  let n = existing.length + 1;
  while (existing.some((axis) => axis.code === `axis-${n}`)) n += 1;
  return `axis-${n}`;
}

export function CategoryVariantEditor({ categoryId }: { categoryId: string }) {
  const { data, isLoading, isError } = useGetCategoryVariantsQuery(categoryId);
  const [replace, { isLoading: isSaving }] = useReplaceCategoryVariantsMutation();
  const [patch] = usePatchCategoryVariantsMutation();

  const [axes, setAxes] = useState<VariantAxis[] | null>(null);
  const [persisted, setPersisted] = useState<VariantAxis[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Loaded once per mount (the page remounts this component via a `key` on
  // categoryId) — see CategorySpecificationEditor for why later automatic
  // refetches never re-run this.
  if (data && axes === null) {
    setAxes(data.variants);
    setPersisted(data.variants);
  }

  function applyServerView(view: { variants: VariantAxis[] }) {
    setAxes(view.variants);
    setPersisted(view.variants);
  }

  function updateAxisAt(index: number, next: VariantAxis) {
    setAxes((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  }

  async function handleSave() {
    if (!axes) return;
    setActionError(null);
    try {
      const view = await replace({ categoryId, variants: axes }).unwrap();
      applyServerView(view);
    } catch (err) {
      const envelope = getApiErrorEnvelope(err);
      setActionError(envelope?.message ?? "Unable to save the variant axes.");
    }
  }

  function handleAddAxis() {
    if (!axes) return;
    const code = nextAxisCode(axes);
    setAxes([...axes, { name: "New axis", code, type: "select", required: false, options: [] }]);
  }

  // The one deliberate divergence from the specification editor (#79):
  // deletion carries no in-use guard at all, matching backend exactly
  // (FR-CAT-037 — this definition drives admin form rendering only, never
  // enforced against stored variant attributes) — so there's no guard
  // rejection branch to handle here, unlike categorySpecifications' delete.
  async function handleDeleteAxis(index: number, code: string) {
    setActionError(null);
    if (isAxisPersisted(persisted, code)) {
      try {
        const view = await patch({ categoryId, operation: { op: "deleteAxis", code } }).unwrap();
        applyServerView(view);
      } catch (err) {
        const envelope = getApiErrorEnvelope(err);
        setActionError(envelope?.message ?? "Unable to delete the axis.");
      }
      return;
    }
    setAxes((prev) => (prev ? prev.filter((_axis, i) => i !== index) : prev));
  }

  async function handleToggleRequired(index: number, code: string, axis: VariantAxis) {
    setActionError(null);
    if (isAxisPersisted(persisted, code)) {
      try {
        const view = await patch({
          categoryId,
          operation: { op: "updateAxis", code, axis },
        }).unwrap();
        applyServerView(view);
      } catch (err) {
        const envelope = getApiErrorEnvelope(err);
        setActionError(envelope?.message ?? "Unable to update the axis.");
      }
      return;
    }
    updateAxisAt(index, axis);
  }

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Unable to load this category's variant axes." />;
  if (!axes) return null;

  return (
    <section className="min-w-0 flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          These definitions drive form rendering only — deleting an axis is unguarded, unlike a
          specification field.
        </p>
        <Button onClick={() => void handleSave()} loading={isSaving} loadingLabel="Saving…">
          Save axes
        </Button>
      </div>

      <Table minWidthClassName="min-w-[760px]">
        <TableHeadRow variant="shaded">
          <th className="px-3 py-2 font-medium text-neutral-500">Axis name</th>
          <th className="px-3 py-2 font-medium text-neutral-500">Code</th>
          <th className="px-3 py-2 font-medium text-neutral-500">Type</th>
          <th className="px-3 py-2 font-medium text-neutral-500">Required</th>
          <th className="px-3 py-2 font-medium text-neutral-500">Options (label / value)</th>
          <th className="px-3 py-2 font-medium text-neutral-500"></th>
        </TableHeadRow>
        <tbody className="divide-y divide-neutral-100">
          {axes.map((axis, index) => (
            <VariantAxisRow
              key={axis.code}
              axis={axis}
              onChange={(next) => updateAxisAt(index, next)}
              onToggleRequired={(next) => void handleToggleRequired(index, axis.code, next)}
              onDelete={() => void handleDeleteAxis(index, axis.code)}
            />
          ))}
        </tbody>
      </Table>

      <Button variant="outline" size="sm" onClick={handleAddAxis}>
        + Add axis
      </Button>

      {actionError && <InlineAlert>{actionError}</InlineAlert>}
    </section>
  );
}
