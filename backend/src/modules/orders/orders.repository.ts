import mongoose, { type Types } from "mongoose";
import { escapeRegExp } from "@/utils/text";
import {
  Order,
  ORDER_STATUSES,
  type OrderDocument,
  type OrderItemSnapshot,
  type OrderShippingAddress,
  type OrderStatus,
  type OrderStatusHistoryEntry,
} from "./orders.model";

// Issue #171/M7.1 — orders in either of these two statuses never
// represent real revenue (no successful payment behind them), so every
// dashboard aggregation below excludes them the same way.
const NON_REVENUE_STATUSES: OrderStatus[] = ["pending_payment", "cancelled"];

export const ORDER_SORT_FIELDS = ["createdAt", "totalAmount"] as const;
export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

export type OrderRecord = OrderDocument & { _id: Types.ObjectId };

export type CreateOrderDoc = {
  orderNumber: string;
  user: Types.ObjectId;
  items: OrderItemSnapshot[];
  shippingAddress: OrderShippingAddress;
  totalAmount: number;
  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntry[];
};

export async function create(doc: CreateOrderDoc): Promise<OrderRecord> {
  const order = await Order.create(doc);
  return order.toObject();
}

export async function findById(id: Types.ObjectId): Promise<OrderRecord | null> {
  return Order.findById(id).lean();
}

// FR-ORD-012, FR-ORD-030's identical pattern — ownership filtered into the
// query itself ({_id, user} together), never fetch-then-check, so a
// non-owned or nonexistent id both resolve to null here.
export async function findOwned(
  id: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<OrderRecord | null> {
  return Order.findOne({ _id: id, user: userId }).lean();
}

// FR-ORD-011 — a buyer's own order history, newest first, paginated. No
// search/sort dimension (unlike the admin list #158 adds) — the SRS
// specifies "newest first" only.
export async function listForUser(
  userId: Types.ObjectId,
  page: { page: number; limit: number },
): Promise<{ items: OrderRecord[]; total: number }> {
  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Order.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(page.limit).lean(),
    Order.countDocuments({ user: userId }),
  ]);
  return { items, total };
}

// FR-ORD-013, FR-ORD-019 — every status write goes through this single
// function: sets `status` and appends one entry to `statusHistory`, in one
// atomic update. orders.service.ts's transitionOrder() is the only caller,
// after orders.stateMachine.ts's assertTransition() has already validated
// the move.
export async function updateStatus(
  id: Types.ObjectId,
  status: OrderStatus,
  historyEntry: OrderStatusHistoryEntry,
  extra?: { trackingReference?: string; cancellationReason?: string },
): Promise<OrderRecord | null> {
  return Order.findByIdAndUpdate(
    id,
    {
      $set: { status, ...extra },
      $push: { statusHistory: historyEntry },
    },
    { new: true },
  ).lean();
}

// FR-ORD-010 — orders left in pending_payment past the 30-minute window,
// for the scheduled auto-cancel sweep (queueWorkers.ts).
export async function findStalePendingPayment(olderThan: Date): Promise<OrderRecord[]> {
  return Order.find({ status: "pending_payment", createdAt: { $lt: olderThan } }).lean();
}

// Raw MongoDB driver against the `users` collection, not a new Mongoose
// model — the established convention this collection already has across
// the authentication modules (adminUsers.repository.ts's own
// usersCollection()), avoiding a competing schema against the same
// collection.
type BuyerRecord = { _id: Types.ObjectId; name?: string; email: string };

function usersCollection() {
  return mongoose.connection.db!.collection<BuyerRecord>("users");
}

// FR-ORD-018 — the ordering buyer's identity, alongside the admin detail
// view.
export async function findBuyerIdentity(
  userId: Types.ObjectId,
): Promise<{ id: string; name: string; email: string } | null> {
  const user = await usersCollection().findOne({ _id: userId });
  if (!user) return null;
  return { id: user._id.toString(), name: user.name ?? "", email: user.email };
}

export type AdminOrderListFilter = {
  status?: OrderStatus;
  search?: string;
};

// FR-ORD-017 — paginated, sortable, status-filterable, searchable by order
// number OR buyer email. orders.user is just an ObjectId (no email field on
// Order itself), so a search resolves matching buyer ids from `users` first,
// then $or's that alongside a direct orderNumber regex — the same
// two-step-lookup shape a real join would take without one being available.
export async function listForAdmin(
  filter: AdminOrderListFilter,
  sort: { field: OrderSortField; order: 1 | -1 } | undefined,
  page: { page: number; limit: number },
): Promise<{ items: OrderRecord[]; total: number }> {
  const mongoFilter: Record<string, unknown> = {};
  if (filter.status) mongoFilter.status = filter.status;

  if (filter.search) {
    const escaped = escapeRegExp(filter.search);
    const matchingBuyers = await usersCollection()
      .find({ email: { $regex: escaped, $options: "i" } }, { projection: { _id: 1 } })
      .toArray();
    mongoFilter.$or = [
      { orderNumber: { $regex: escaped, $options: "i" } },
      { user: { $in: matchingBuyers.map((buyer) => buyer._id) } },
    ];
  }

  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Order.find(mongoFilter)
      .sort(sort ? { [sort.field]: sort.order } : { createdAt: -1 })
      .skip(skip)
      .limit(page.limit)
      .lean(),
    Order.countDocuments(mongoFilter),
  ]);
  return { items, total };
}

// Issue #171/M7.1 (FR-DASH-001/004) — every order placed within the range,
// grouped by status. totalOrders counts every status (including
// pending_payment/cancelled) since this is an order-volume metric, not a
// revenue one.
export type SalesRangeSummary = {
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
};

export async function countAndRevenueInRange(from: Date, to: Date): Promise<SalesRangeSummary> {
  const results = await Order.aggregate<{ _id: OrderStatus; count: number }>([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const ordersByStatus = ORDER_STATUSES.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<OrderStatus, number>,
  );
  let totalOrders = 0;
  for (const row of results) {
    ordersByStatus[row._id] = row.count;
    totalOrders += row.count;
  }
  return { totalOrders, ordersByStatus };
}

export type SalesBucketPoint = { date: string; revenue: number; orders: number };

// Issue #171/M7.1 (FR-DASH-005) — bucketed by the order's own createdAt, not
// payments.capturedAt: this is an order-volume-over-time view, distinct from
// getSalesSummary's payments-based net revenue figure. `revenue` here is
// each order's own totalAmount (whole rupees already — no /100 conversion
// needed, unlike the payments-sourced figures), excluding orders that never
// represented a real sale (NON_REVENUE_STATUSES).
export async function salesOverTimeInRange(
  from: Date,
  to: Date,
  bucket: "day" | "week",
): Promise<SalesBucketPoint[]> {
  const dateFormat = bucket === "day" ? "%Y-%m-%d" : "%G-W%V";
  const results = await Order.aggregate<{ _id: string; revenue: number; orders: number }>([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        revenue: {
          $sum: { $cond: [{ $in: ["$status", NON_REVENUE_STATUSES] }, 0, "$totalAmount"] },
        },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return results.map((row) => ({ date: row._id, revenue: row.revenue, orders: row.orders }));
}

export type TopProductRow = {
  productId: string;
  name: string;
  slug: string;
  unitsSold: number;
  revenue: number;
};

// Issue #171/M7.1 (FR-DASH-006/017) — top-selling products by revenue within
// a range, tiebroken by units sold. Sourced from each order's own frozen
// item snapshot (orders.model.ts's OrderItemSnapshot), not a live product
// lookup — matches every other order-history read in this codebase, which
// never re-resolves a snapshot against current catalog state.
export async function topProductsInRange(
  from: Date,
  to: Date,
  limit = 10,
): Promise<TopProductRow[]> {
  const results = await Order.aggregate<{
    _id: Types.ObjectId;
    name: string;
    slug: string;
    unitsSold: number;
    revenue: number;
  }>([
    {
      $match: {
        createdAt: { $gte: from, $lte: to },
        status: { $nin: NON_REVENUE_STATUSES },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product.id",
        name: { $first: "$items.product.name" },
        slug: { $first: "$items.product.slug" },
        unitsSold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
      },
    },
    { $sort: { revenue: -1, unitsSold: -1 } },
    { $limit: limit },
  ]);

  return results.map((row) => ({
    productId: row._id.toString(),
    name: row.name,
    slug: row.slug,
    unitsSold: row.unitsSold,
    revenue: row.revenue,
  }));
}

export type LifetimeStats = {
  orderIds: Types.ObjectId[];
  lifetimeOrderCount: number;
  lifetimeAmountSpent: number;
};

// Issue #173/M7.3 — a buyer's own lifetime order count/spend, excluding
// orders that never represented a real sale. orderIds is returned so the
// caller (account.service.ts) can net out any refunds against exactly these
// orders via payments.repository.ts's sumRefundsForOrders.
export async function lifetimeStatsForUser(userId: Types.ObjectId): Promise<LifetimeStats> {
  const orders = await Order.find(
    { user: userId, status: { $nin: NON_REVENUE_STATUSES } },
    { totalAmount: 1 },
  ).lean();

  return {
    orderIds: orders.map((order) => order._id),
    lifetimeOrderCount: orders.length,
    lifetimeAmountSpent: orders.reduce((sum, order) => sum + order.totalAmount, 0),
  };
}
