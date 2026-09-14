import { OrderDetailContent } from "@/features/orders/OrderDetailContent";

export const metadata = {
  title: "Order Details",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailContent id={id} />;
}
