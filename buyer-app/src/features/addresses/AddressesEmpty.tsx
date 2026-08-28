export function AddressesEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 p-16 text-center">
      <p className="text-base font-medium text-neutral-900">No saved addresses yet</p>
      <p className="text-sm text-neutral-500">Add an address to speed up checkout.</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        Add an address
      </button>
    </div>
  );
}
