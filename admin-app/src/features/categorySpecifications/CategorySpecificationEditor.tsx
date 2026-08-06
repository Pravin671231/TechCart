import { useState } from "react";
import { getApiErrorEnvelope } from "@/store/api";
import {
  useGetCategorySpecificationsQuery,
  usePatchCategorySpecificationsMutation,
  useReplaceCategorySpecificationsMutation,
} from "./categorySpecificationsApi";
import { SpecificationGroupCard } from "./SpecificationGroupCard";
import type { SpecificationField, SpecificationGroup } from "./types";

function isGroupPersisted(persisted: SpecificationGroup[], groupName: string): boolean {
  return persisted.some((group) => group.groupName === groupName);
}

function isFieldPersisted(persisted: SpecificationGroup[], groupName: string, name: string): boolean {
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

export function CategorySpecificationEditor({ categoryId }: { categoryId: string }) {
  const { data, isLoading, isError } = useGetCategorySpecificationsQuery(categoryId);
  const [replace, { isLoading: isSaving }] = useReplaceCategorySpecificationsMutation();
  const [patch] = usePatchCategorySpecificationsMutation();

  const [groups, setGroups] = useState<SpecificationGroup[] | null>(null);
  const [persisted, setPersisted] = useState<SpecificationGroup[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

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

  function updateGroup(groupIndex: number, updater: (group: SpecificationGroup) => SpecificationGroup) {
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
        const view = await patch({ categoryId, operation: { op: "deleteGroup", groupName } }).unwrap();
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
        { name: nextFieldName(group.specifications), type: "text", required: false, filterable: false },
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

  if (isLoading) return <p className="mt-4 text-sm text-neutral-500">Loading…</p>;
  if (isError) return <p className="mt-4 text-sm text-red-600">Unable to load this category's specification schema.</p>;
  if (!groups) return null;

  return (
    <section className="min-w-0 flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          Marking a field filterable makes it a buyer-facing filter and eligible for category card
          display (first four, in order).
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save schema"}
        </button>
      </div>

      {groups.map((group, groupIndex) => (
        <SpecificationGroupCard
          key={group.groupName}
          group={group}
          onRenameGroup={(newName) => void handleRenameGroup(groupIndex, group.groupName, newName)}
          onDeleteGroup={() => void handleDeleteGroup(groupIndex, group.groupName)}
          onAddField={() => handleAddField(groupIndex)}
          onFieldChange={(fieldIndex, field) => handleFieldChange(groupIndex, fieldIndex, field)}
          onToggleFilterable={(fieldIndex, field) =>
            void handleToggleFilterable(groupIndex, group.groupName, fieldIndex, field)
          }
          onDeleteField={(fieldIndex) => void handleDeleteField(groupIndex, group.groupName, fieldIndex)}
          onMoveField={(fieldIndex, direction) => handleMoveField(groupIndex, fieldIndex, direction)}
        />
      ))}

      <button
        type="button"
        onClick={handleAddGroup}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
      >
        + Add group
      </button>

      {actionError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {actionError}
        </div>
      )}
    </section>
  );
}
