import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader
        title="Brands"
        actions={
          <Button
            onClick={() => {
              setSelectedBrand(null);
              setIsCreating(true);
            }}
          >
            + New brand
          </Button>
        }
      />

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
