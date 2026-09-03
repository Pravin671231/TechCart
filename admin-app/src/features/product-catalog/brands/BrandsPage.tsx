import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { BrandForm } from "./BrandForm";
import { BrandList } from "./BrandList";
import type { BrandListItem } from "./types";

export const BrandsPage = () => {
  const [selectedBrand, setSelectedBrand] = useState<BrandListItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const showForm = isCreating || selectedBrand !== null;

  function closeForm() {
    setIsCreating(false);
    setSelectedBrand(null);
  }

  return (
    <main className="flex h-full min-h-0 flex-col p-6">
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

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
        <BrandList
          onEdit={(brand) => {
            setIsCreating(false);
            setSelectedBrand(brand);
          }}
        />
        {showForm && (
          <div className="w-full shrink-0 overflow-y-auto xl:w-96">
            <BrandForm
              brand={isCreating ? null : selectedBrand}
              onSaved={closeForm}
              onCancel={closeForm}
            />
          </div>
        )}
      </div>
    </main>
  );
};
