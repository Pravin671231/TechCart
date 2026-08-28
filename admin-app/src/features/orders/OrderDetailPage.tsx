import { useState } from "react";
import { useParams } from "react-router";
import { BreadcrumbHeading } from "@/components/ui/BreadcrumbHeading";
import { Card, CardHeading } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/LoadingState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableHeadRow } from "@/components/ui/Table";
import { formatPrice } from "@/features/product-catalog/products/money";
import { CancelOrderModal } from "./CancelOrderModal";
import { ORDER_TRANSITIONS, CANCELLABLE_STATUSES } from "./orderTransitions";
import { ORDERS_ROUTES } from "./routePaths";
import { STATUS_LABEL, STATUS_TONE } from "./statusPresentation";
import {
  useCancelOrderMutation,
  useGetOrderQuery,
  useUpdateOrderStatusMutation,
} from "./ordersApi";
import type { OrderStatus } from "./types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatAttributes(attributes: { name: string; value: string }[]): string {
  return attributes.map((attribute) => `${attribute.name}=${attribute.value}`).join(" · ");
}

export const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, isError } = useGetOrderQuery(id ?? "", { skip: !id });
  const [updateStatus, { isLoading: isChangingStatus }] = useUpdateOrderStatusMutation();
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();
  const [showCancelModal, setShowCancelModal] = useState(false);

  if (isLoading) return <LoadingState fullPage />;
  if (isError || !order) {
    return <ErrorState fullPage message="Unable to load this order." />;
  }

  const legalNextStatuses = ORDER_TRANSITIONS[order.status];
  const canCancel = CANCELLABLE_STATUSES.includes(order.status);

  async function handleStatusChange(status: OrderStatus) {
    await updateStatus({ id: order!.id, status }).unwrap();
  }

  async function handleCancelConfirm(reason: string) {
    await cancelOrder({ id: order!.id, reason }).unwrap();
    setShowCancelModal(false);
  }

  return (
    <main className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <BreadcrumbHeading
          backTo={ORDERS_ROUTES.list}
          backLabel="Orders"
          current={`Order #${order.orderNumber}`}
        />
        <div className="flex items-center gap-2 text-sm">
          {/* Constrained to legal next states only (Issue #163) — never a
              free-form dropdown, unlike products' own tri-state select. A
              terminal status (cancelled/refunded) has no legal next state,
              so the control is inert with only its own value shown. */}
          <label className="flex items-center gap-2">
            <span className="text-neutral-500">Change status</span>
            <select
              value={order.status}
              disabled={isChangingStatus || legalNextStatuses.length === 0}
              onChange={(event) => void handleStatusChange(event.target.value as OrderStatus)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-600"
            >
              <option value={order.status}>{STATUS_LABEL[order.status]}</option>
              {legalNextStatuses.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          {canCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Cancel order
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</StatusBadge>
        <span className="text-sm text-neutral-500">Placed {formatDateTime(order.createdAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeading>Details</CardHeading>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-neutral-500">Buyer</dt>
                <dd className="text-neutral-900">{order.buyer?.name ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-neutral-500">Email</dt>
                <dd className="text-neutral-900">{order.buyer?.email ?? "—"}</dd>
              </div>
              {order.trackingReference && (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-neutral-500">Tracking</dt>
                  <dd className="font-mono text-xs text-neutral-800">{order.trackingReference}</dd>
                </div>
              )}
              {order.cancellationReason && (
                <div className="flex gap-2 sm:col-span-2">
                  <dt className="w-28 shrink-0 text-neutral-500">Cancellation</dt>
                  <dd className="text-neutral-900">{order.cancellationReason}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeading>Items</CardHeading>
            <Table minWidthClassName="min-w-[600px]">
              <TableHeadRow variant="shaded">
                <th className="px-3 py-2 font-medium text-neutral-500">Product</th>
                <th className="px-3 py-2 font-medium text-neutral-500">Attributes</th>
                <th className="px-3 py-2 text-right font-medium text-neutral-500">Qty</th>
                <th className="px-3 py-2 text-right font-medium text-neutral-500">Unit price</th>
                <th className="px-3 py-2 text-right font-medium text-neutral-500">Line total</th>
              </TableHeadRow>
              <tbody className="divide-y divide-neutral-100">
                {order.items.map((item) => (
                  <tr key={item.variant.id}>
                    <td className="px-3 py-2 text-neutral-900">{item.product.name}</td>
                    <td className="px-3 py-2 text-neutral-600">
                      {formatAttributes(item.variant.attributes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPrice(item.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-neutral-900">
                      {formatPrice(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-3 flex justify-end text-sm font-semibold text-neutral-900">
              Total: {formatPrice(order.totalAmount)}
            </div>
          </Card>

          <Card>
            <CardHeading>Shipping address</CardHeading>
            <p className="text-sm text-neutral-700">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
              {order.shippingAddress.pincode}
              <br />
              {order.shippingAddress.phone}
            </p>
          </Card>
        </div>

        <Card>
          <CardHeading>Status timeline</CardHeading>
          <ol className="flex flex-col gap-3">
            {order.statusHistory.map((entry, index) => (
              <li key={`${entry.status}-${entry.at}-${index}`} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                <span className="flex flex-col">
                  <span className="flex items-center gap-2">
                    <StatusBadge tone={STATUS_TONE[entry.status]}>
                      {STATUS_LABEL[entry.status]}
                    </StatusBadge>
                    <span className="text-xs text-neutral-500">{formatDateTime(entry.at)}</span>
                  </span>
                  {entry.note && (
                    <span className="mt-0.5 text-xs text-neutral-500">{entry.note}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <CancelOrderModal
        open={showCancelModal}
        onConfirm={(reason) => void handleCancelConfirm(reason)}
        onCancel={() => setShowCancelModal(false)}
        isConfirming={isCancelling}
      />
    </main>
  );
};
