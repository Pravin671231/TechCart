import { useState } from "react";
import { BrandForm } from "./BrandForm";
import { BrandList } from "./BrandList";
import type { BrandListItem } from "./types";

export function BrandsPage() {
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<BrandListItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const showForm = isCreating || selectedBrand !== null;

  function closeForm() {
    setIsCreating(false);
    setSelectedBrand(null);
  }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Brands</h1>
        <button
          type="button"
          onClick={() => {
            setSelectedBrand(null);
            setIsCreating(true);
          }}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + New brand
        </button>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <BrandList
          search={search}
          onSearchChange={setSearch}
          onEdit={(brand) => {
            setIsCreating(false);
            setSelectedBrand(brand);
          }}
        />
        {showForm && (
          <BrandForm brand={isCreating ? null : selectedBrand} onSaved={closeForm} onCancel={closeForm} />
        )}
      </div>
    </main>
  );
}
