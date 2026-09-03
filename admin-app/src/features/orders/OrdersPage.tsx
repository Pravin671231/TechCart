import { PageHeader } from "@/components/layout/PageHeader";
import { OrderList } from "./OrderList";

export const OrdersPage = () => {
  return (
    <main className="flex h-full min-h-0 flex-col p-6">
      <PageHeader title="Orders" />
      <OrderList />
    </main>
  );
};
