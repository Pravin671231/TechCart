import { OrderStatusBadge } from "./OrderStatusBadge";
import type { OrderResponse } from "./types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// A simple ordered list of every recorded transition — statusHistory is
// already append-only and chronological (orders.service.ts), so no
// re-sorting is needed here.
export function OrderStatusTimeline({
  statusHistory,
}: {
  statusHistory: OrderResponse["statusHistory"];
}) {
  return (
    <ol className="flex flex-col gap-3">
      {statusHistory.map((entry, index) => (
        <li key={`${entry.status}-${entry.at}-${index}`} className="flex items-start gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-600" />
          <span className="flex flex-col">
            <span className="flex items-center gap-2">
              <OrderStatusBadge status={entry.status} />
              <span className="text-xs text-neutral-500">{formatDateTime(entry.at)}</span>
            </span>
            {entry.note && <span className="mt-0.5 text-xs text-neutral-500">{entry.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
