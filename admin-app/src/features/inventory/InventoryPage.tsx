import { PageHeader } from "@/components/layout/PageHeader";
import { InventoryList } from "./InventoryList";

export const InventoryPage = () => {
  return (
    <main className="flex h-full min-h-0 flex-col p-6">
      <PageHeader title="Inventory" />
      <InventoryList />
    </main>
  );
};
