import { useState } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { Button } from "@/components/ui/Button";
import { AlertModal } from "@/components/ui/AlertModal";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ErrorState, LoadingState } from "@/components/ui/LoadingState";
import {
  useGetCategorySpecificationsQuery,
  usePatchCategorySpecificationsMutation,
  useReplaceCategorySpecificationsMutation,
} from "./categorySpecificationsApi";
import { SpecificationGroupCard } from "./SpecificationGroupCard";
import type { SpecificationField, SpecificationGroup } from "./types";

type PendingDelete =
  | { kind: "group"; groupIndex: number; groupName: string }
  | { kind: "field"; groupIndex: number; groupName: string; fieldIndex: number; fieldName: string };

function isGroupPersisted(persisted: SpecificationGroup[], groupName: string): boolean {
  return persisted.some((group) => group.groupName === groupName);
}

function isFieldPersisted(
  persisted: SpecificationGroup[],
  groupName: string,
  name: string,
): boolean {
  const group = persisted.find((g) => g.groupName === groupName);
  return group ? group.specifications.some((field) => field.name === name) : false;
}

function nextGroupName(existing: SpecificationGroup[]): string {
  let n = existing.length + 1;
  while (existing.some((group) => group.groupName === `New group ${n}`)) n += 1;
  return `New group ${n}`;
}

function nextFieldName(existing: SpecificationField[]): string {
  let n = existing.length + 1;
  while (existing.some((field) => field.name === `New field ${n}`)) n += 1;
  return `New field ${n}`;
}

export const CategorySpecificationEditor = ({ categoryId }: { categoryId: string }) => {
  const { data, isLoading, isError } = useGetCategorySpecificationsQuery(categoryId);
  const [replace, { isLoading: isSaving }] = useReplaceCategorySpecificationsMutation();
  const [patch, { isLoading: isPatching }] = usePatchCategorySpecificationsMutation();

  const [groups, setGroups] = useState<SpecificationGroup[] | null>(null);
  const [persisted, setPersisted] = useState<SpecificationGroup[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  // Loaded once per mount (the page remounts this component via a `key` on
  // categoryId) — later automatic refetches from our own tag invalidation
  // never re-run this, since our mutation handlers below already apply the
  // fresh server response directly and would otherwise clobber in-progress,
  // not-yet-saved local edits (a new field/group added but not yet PUT).
  if (data && groups === null) {
    setGroups(data.specificationGroups);
    setPersisted(data.specificationGroups);
  }

  function applyServerView(view: { specificationGroups: SpecificationGroup[] }) {
    setGroups(view.specificationGroups);
    setPersisted(view.specificationGroups);
  }

  function updateGroup(
    groupIndex: number,
    updater: (group: SpecificationGroup) => SpecificationGroup,
  ) {
    setGroups((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[groupIndex] = updater(next[groupIndex]!);
      return next;
    });
  }

  async function handleSave() {
    if (!groups) return;
    setActionError(null);
    try {
      const view = await replace({ categoryId, specificationGroups: groups }).unwrap();
      applyServerView(view);
    } catch (err) {
      const envelope = getApiErrorEnvelope(err);
      setActionError(envelope?.message ?? "Unable to save the specification schema.");
    }
  }

  function handleAddGroup() {
    if (!groups) return;
    setGroups([...groups, { groupName: nextGroupName(groups), specifications: [] }]);
  }

  async function handleRenameGroup(groupIndex: number, groupName: string, newName: string) {
    setActionError(null);
    if (isGroupPersisted(persisted, groupName)) {
      try {
        const view = await patch({
          categoryId,
          operation: { op: "renameGroup", groupName, newGroupName: newName },
        }).unwrap();
        applyServerView(view);
      } catch (err) {
        const envelope = getApiErrorEnvelope(err);
        setActionError(envelope?.message ?? "Unable to rename the group.");
      }
      return;
    }
    updateGroup(groupIndex, (group) => ({ ...group, groupName: newName }));
  }

  async function handleDeleteGroup(groupIndex: number, groupName: string) {
    setActionError(null);
    if (isGroupPersisted(persisted, groupName)) {
      try {
        const view = await patch({
          categoryId,
          operation: { op: "deleteGroup", groupName },
        }).unwrap();
        applyServerView(view);
      } catch (err) {
        const envelope = getApiErrorEnvelope(err);
        setActionError(envelope?.message ?? "Unable to delete the group.");
      }
      return;
    }
    setGroups((prev) => (prev ? prev.filter((_group, i) => i !== groupIndex) : prev));
  }

  function handleAddField(groupIndex: number) {
    updateGroup(groupIndex, (group) => ({
      ...group,
      specifications: [
        ...group.specifications,
        {
          name: nextFieldName(group.specifications),
          type: "text",
          required: false,
          filterable: false,
        },
      ],
    }));
  }

  function handleFieldChange(groupIndex: number, fieldIndex: number, field: SpecificationField) {
    updateGroup(groupIndex, (group) => {
      const specifications = [...group.specifications];
      specifications[fieldIndex] = field;
      return { ...group, specifications };
    });
  }

  async function handleToggleFilterable(
    groupIndex: number,
    groupName: string,
    fieldIndex: number,
    field: SpecificationField,
  ) {
    setActionError(null);
    const originalName = groups![groupIndex]!.specifications[fieldIndex]!.name;
    if (isFieldPersisted(persisted, groupName, originalName)) {
      try {
        const view = await patch({
          categoryId,
          operation: { op: "updateField", groupName, name: originalName, field },
        }).unwrap();
        applyServerView(view);
      } catch (err) {
        const envelope = getApiErrorEnvelope(err);
        setActionError(envelope?.message ?? "Unable to update the field.");
      }
      return;
    }
    handleFieldChange(groupIndex, fieldIndex, field);
  }

  async function handleDeleteField(groupIndex: number, groupName: string, fieldIndex: number) {
    setActionError(null);
    const name = groups![groupIndex]!.specifications[fieldIndex]!.name;
    if (isFieldPersisted(persisted, groupName, name)) {
      try {
        const view = await patch({
          categoryId,
          operation: { op: "deleteField", groupName, name },
        }).unwrap();
        applyServerView(view);
      } catch (err) {
        const envelope = getApiErrorEnvelope(err);
        setActionError(envelope?.message ?? "Unable to delete the field.");
      }
      return;
    }
    updateGroup(groupIndex, (group) => ({
      ...group,
      specifications: group.specifications.filter((_field, i) => i !== fieldIndex),
    }));
  }

  function handleMoveField(groupIndex: number, fieldIndex: number, direction: -1 | 1) {
    updateGroup(groupIndex, (group) => {
      const target = fieldIndex + direction;
      if (target < 0 || target >= group.specifications.length) return group;
      const specifications = [...group.specifications];
      const [moved] = specifications.splice(fieldIndex, 1);
      specifications.splice(target, 0, moved!);
      return { ...group, specifications };
    });
  }

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Unable to load this category's specification schema." />;
  if (!groups) return null;

  return (
    <section className="min-w-0 flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          Marking a field filterable makes it a buyer-facing filter and eligible for category card
          display (first four, in order).
        </p>
        <Button onClick={() => void handleSave()} loading={isSaving} loadingLabel="Saving…">
          Save schema
        </Button>
      </div>

      {groups.map((group, groupIndex) => (
        <SpecificationGroupCard
          key={group.groupName}
          group={group}
          onRenameGroup={(newName) => void handleRenameGroup(groupIndex, group.groupName, newName)}
          onDeleteGroup={() =>
            setPendingDelete({ kind: "group", groupIndex, groupName: group.groupName })
          }
          onAddField={() => handleAddField(groupIndex)}
          onFieldChange={(fieldIndex, field) => handleFieldChange(groupIndex, fieldIndex, field)}
          onToggleFilterable={(fieldIndex, field) =>
            void handleToggleFilterable(groupIndex, group.groupName, fieldIndex, field)
          }
          onDeleteField={(fieldIndex) =>
            setPendingDelete({
              kind: "field",
              groupIndex,
              groupName: group.groupName,
              fieldIndex,
              fieldName: group.specifications[fieldIndex]!.name,
            })
          }
          onMoveField={(fieldIndex, direction) =>
            handleMoveField(groupIndex, fieldIndex, direction)
          }
        />
      ))}

      <Button variant="outline" size="sm" onClick={handleAddGroup}>
        + Add group
      </Button>

      {actionError && <InlineAlert>{actionError}</InlineAlert>}

      <AlertModal
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === "field" ? "Delete field" : "Delete group"}
        message={
          pendingDelete?.kind === "field"
            ? `Delete "${pendingDelete.fieldName}"? This can't be undone.`
            : `Delete "${pendingDelete?.groupName}"? This can't be undone.`
        }
        isConfirming={isPatching}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (!target) return;
          if (target.kind === "group") {
            void handleDeleteGroup(target.groupIndex, target.groupName);
          } else {
            void handleDeleteField(target.groupIndex, target.groupName, target.fieldIndex);
          }
        }}
      />
    </section>
  );
};
