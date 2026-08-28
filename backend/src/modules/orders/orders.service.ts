import { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
// FR-ORD-001-007 — checkout reuses cart's own live-resolved response
// (pricing, availability, and the exact product/variant view checkout's
// item snapshot needs) rather than re-deriving that logic here. Cart's
// buildCartResponse() already resolves everything fresh from current
// product/variant data on every call, so calling getCart() at the top of
// checkout *is* FR-ORD-025's commit-time re-validation — there's no separate
// "last read" to go stale against within one synchronous request. This is a
// service-to-service reuse (not the repository-only peer exception
// cart.service/brands.service use for products.repository), justified here
// because getCart() is a read-only, already-composed operation with no
// side effects to duplicate incorrectly.
import { getCart } from "@/modules/cart/cart.service";
import { replaceItems as replaceCartItems } from "@/modules/cart/cart.repository";
import {
  addAddress,
  getDefaultAddress,
  getOwnedAddress,
} from "@/modules/addresses/addresses.service";
import type { AddressInput, AddressRecord } from "@/modules/addresses/addresses.repository";
import { buildPagination, type Pagination } from "@/utils/apiResponse";
import { allocateOrderNumber } from "./orderNumber";
import {
  create,
  findBuyerIdentity,
  findById,
  findOwned,
  findStalePendingPayment,
  listForAdmin,
  listForUser,
  updateStatus,
  type AdminOrderListFilter,
  type OrderRecord,
  type OrderSortField,
} from "./orders.repository";
import type { OrderShippingAddress, OrderStatus } from "./orders.model";
import { assertTransition } from "./orders.stateMachine";

export type CheckoutInput = {
  addressId?: string | undefined;
  shippingAddress?: AddressInput | undefined;
};

export type OrderItemView = {
  product: { id: string; name: string; slug: string };
  variant: {
    id: string;
    sku: string;
    attributes: { name: string; value: string }[];
    image: { url: string; alt?: string } | null;
  };
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type OrderResponse = {
  id: string;
  orderNumber: string;
  user: string;
  status: OrderStatus;
  items: OrderItemView[];
  shippingAddress: OrderShippingAddress;
  totalAmount: number;
  statusHistory: { status: OrderStatus; at: string; note?: string }[];
  trackingReference?: string;
  cancellationReason?: string;
  createdAt: string;
};

export type CheckoutResponse = OrderResponse & {
  droppedItems?: { sku: string; reason: string }[];
};

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

// Shared by every order-returning endpoint added across M5's issues.
// Exported so #157 (buyer detail/list) and #158 (admin) reuse it verbatim
// rather than re-deriving the same shape.
export function buildOrderResponse(order: OrderRecord): OrderResponse {
  const base: OrderResponse = {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    user: order.user.toString(),
    status: order.status,
    items: order.items.map((item) => ({
      product: {
        id: item.product.id.toString(),
        name: item.product.name,
        slug: item.product.slug,
      },
      variant: {
        id: item.variant.id.toString(),
        sku: item.variant.sku,
        attributes: item.variant.attributes,
        image: item.variant.image,
      },
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    shippingAddress: order.shippingAddress,
    totalAmount: order.totalAmount,
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      at: entry.at.toISOString(),
      ...(entry.note !== undefined ? { note: entry.note } : {}),
    })),
    createdAt: order.createdAt.toISOString(),
  };
  return {
    ...base,
    ...(order.trackingReference !== undefined
      ? { trackingReference: order.trackingReference }
      : {}),
    ...(order.cancellationReason !== undefined
      ? { cancellationReason: order.cancellationReason }
      : {}),
  };
}

function toShippingSnapshot(address: AddressRecord): OrderShippingAddress {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    ...(address.line2 !== undefined ? { line2: address.line2 } : {}),
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  };
}

// FR-ORD-004, FR-ORD-033 — addressId takes priority, then an inline address
// (saved as a side effect), then the buyer's default; rejected if none of
// the three resolve to anything.
async function resolveShippingAddress(
  userId: string,
  input: CheckoutInput,
): Promise<OrderShippingAddress> {
  if (input.addressId) {
    const address = await getOwnedAddress(userId, input.addressId);
    return toShippingSnapshot(address);
  }
  if (input.shippingAddress) {
    const saved = await addAddress(userId, input.shippingAddress);
    return toShippingSnapshot(saved);
  }
  const defaultAddress = await getDefaultAddress(userId);
  if (!defaultAddress) {
    throw new AppError(
      400,
      "ADDRESS_REQUIRED",
      "Add a shipping address or set a default address before checking out.",
    );
  }
  return toShippingSnapshot(defaultAddress);
}

// FR-ORD-001-007, FR-ORD-025-027, FR-ORD-033.
export async function checkout(userId: string, input: CheckoutInput): Promise<CheckoutResponse> {
  const cart = await getCart(userId);

  const availableLines = cart.items.filter((line) => !line.unavailable);
  // FR-ORD-002 — zero available lines (including an entirely empty cart) is
  // rejected outright; unavailable-only lines are treated as empty.
  if (availableLines.length === 0) {
    throw new AppError(400, "CART_EMPTY", "Your cart has no available items to check out.");
  }

  const shippingAddress = await resolveShippingAddress(userId, input);

  const items: OrderResponse["items"] = availableLines.map((line) => ({
    product: line.variant.product,
    variant: {
      id: line.variant.id,
      sku: line.variant.sku,
      attributes: line.variant.attributes,
      image: line.variant.primaryImage,
    },
    unitPrice: line.sellingPrice,
    quantity: line.quantity,
    lineTotal: line.lineTotal,
  }));

  // FR-ORD-005, FR-ORD-027 — always server-computed; the client never
  // supplies totalAmount at all (the checkout Zod schema has no such field).
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

  // FR-ORD-025 — every unavailable line at this moment is dropped and
  // reported, rather than failing checkout outright.
  const droppedLines = cart.items.filter((line) => line.unavailable);
  const droppedItems = droppedLines.map((line) => ({
    sku: line.variant.sku,
    reason: "VARIANT_UNAVAILABLE",
  }));

  const orderNumber = await allocateOrderNumber();
  const now = new Date();

  const order = await create({
    orderNumber,
    user: toObjectId(userId),
    items: items.map((item) => ({
      product: {
        id: toObjectId(item.product.id),
        name: item.product.name,
        slug: item.product.slug,
      },
      variant: {
        id: toObjectId(item.variant.id),
        sku: item.variant.sku,
        attributes: item.variant.attributes,
        image: item.variant.image,
      },
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    shippingAddress,
    totalAmount,
    status: "pending_payment",
    statusHistory: [{ status: "pending_payment", at: now }],
  });

  // FR-ORD-006 — clear only the lines that made it into the order; dropped/
  // unavailable lines stay in the cart for the buyer to deal with. Reaches
  // into cart's repository directly (the documented peer-repository
  // exception cart.service/brands.service already establish) since this is
  // a second, distinct write from order creation — see this module's PR
  // description for the accepted non-transactional-atomicity gap.
  const remainingCartItems = droppedLines.map((line) => ({
    variant: toObjectId(line.variant.id),
    quantity: line.quantity,
  }));
  await replaceCartItems(toObjectId(userId), remainingCartItems);

  // FR-ORD-021 — enqueued after the order is committed. Awaiting this only
  // waits on the job being *added* to the queue (near-instant, and the
  // function itself never throws — enqueue failures are caught and logged
  // internally); the actual email send happens later, asynchronously, in
  // the worker — never inline within this request/response cycle.
  //
  // Dynamic, not a static top-level import: orders.notifications.ts pulls
  // in @/lib/queue -> @/config/env, and several test files import THIS
  // module (orders.service.ts) statically at their own top level to call
  // transitionOrder()/markOrderPaid() directly (not via HTTP). A static
  // import here would make @/config/env's envSchema.parse(process.env) run
  // as part of those test files' own module evaluation, before their
  // beforeAll's bootstrapMemoryMongo() gets a chance to set the real
  // MONGODB_URI — freezing env.MONGODB_URI on vitest.config.ts's injected
  // placeholder for that worker's lifetime. Same bug class, same fix
  // pattern vitest.setup.ts's own header comment documents for the
  // identical reason.
  const { enqueueOrderConfirmation } = await import("./orders.notifications.js");
  await enqueueOrderConfirmation(order);

  return {
    ...buildOrderResponse(order),
    ...(droppedItems.length > 0 ? { droppedItems } : {}),
  };
}

function orderNotFound(): AppError {
  return new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
}

// FR-ORD-013 — every status write anywhere in this codebase goes through
// this one function: validates the move via the state machine, then
// persists the new status plus one statusHistory entry in one atomic
// update. Reused by #157's buyer cancel, #158's admin advance/cancel, and
// this issue's own auto-cancel sweep below.
export async function transitionOrder(
  orderId: Types.ObjectId,
  toStatus: OrderStatus,
  options?: { note?: string; trackingReference?: string; cancellationReason?: string },
): Promise<OrderRecord> {
  const order = await findById(orderId);
  if (!order) {
    throw orderNotFound();
  }

  assertTransition(order.status, toStatus);

  const updated = await updateStatus(
    orderId,
    toStatus,
    {
      status: toStatus,
      at: new Date(),
      ...(options?.note !== undefined ? { note: options.note } : {}),
    },
    {
      ...(options?.trackingReference !== undefined
        ? { trackingReference: options.trackingReference }
        : {}),
      ...(options?.cancellationReason !== undefined
        ? { cancellationReason: options.cancellationReason }
        : {}),
    },
  );
  if (!updated) {
    throw orderNotFound();
  }

  // FR-ORD-022 — enqueued here, not at each individual call site, so every
  // caller of transitionOrder (buyer cancel, admin advance/cancel, the
  // auto-cancel sweep) gets notification coverage for free. A no-op for any
  // status not in the notifiable set (e.g. processing). Dynamic import —
  // see the identical comment on checkout()'s own enqueue call above.
  const { enqueueStatusNotification } = await import("./orders.notifications.js");
  await enqueueStatusNotification(updated, toStatus);

  return updated;
}

// FR-ORD-009 — reserved for Payments (v0.6) to call once it verifies a real
// Razorpay payment against this order. Deliberately not wired to any
// Express route anywhere in this codebase. paymentId isn't persisted yet
// since orders.model.ts (v0.5) has no payment-reference field of its own —
// v0.6 will extend the schema when it lands.
export async function markOrderPaid(
  orderId: Types.ObjectId,
  _paymentId: string,
): Promise<OrderRecord> {
  return transitionOrder(orderId, "paid");
}

// FR-ORD-010 — orders left in pending_payment past 30 minutes are
// auto-cancelled by queueWorkers.ts's repeatable BullMQ job. A run that
// finds nothing to cancel is not itself an error (SRS v0.5 §3).
const AUTO_CANCEL_WINDOW_MS = 30 * 60 * 1000;

export async function runAutoCancelSweep(): Promise<{ cancelledCount: number }> {
  const cutoff = new Date(Date.now() - AUTO_CANCEL_WINDOW_MS);
  const stale = await findStalePendingPayment(cutoff);

  for (const order of stale) {
    await transitionOrder(order._id, "cancelled", {
      note: "Auto-cancelled after 30 minutes with no successful payment.",
    });
  }

  if (stale.length > 0) {
    console.log(
      `[orders] auto-cancel sweep: cancelled ${stale.length} stale pending_payment order(s).`,
    );
  } else {
    console.log("[orders] auto-cancel sweep: nothing to cancel.");
  }

  return { cancelledCount: stale.length };
}

// FR-ORD-011 — own orders only, newest first, paginated.
export async function listOrdersForBuyer(
  userId: string,
  page: number,
  limit: number,
): Promise<{ items: OrderResponse[]; pagination: Pagination }> {
  const { items, total } = await listForUser(toObjectId(userId), { page, limit });
  return {
    items: items.map(buildOrderResponse),
    pagination: buildPagination(page, limit, total),
  };
}

// FR-ORD-012 — a non-owned order id gets the identical error a nonexistent
// one would (findOwned filters {_id, user} together), so order ids can't be
// used to enumerate other buyers' purchases.
export async function getOwnedOrder(userId: string, orderId: string): Promise<OrderResponse> {
  const order = await findOwned(toObjectId(orderId), toObjectId(userId));
  if (!order) throw orderNotFound();
  return buildOrderResponse(order);
}

// FR-ORD-014 — buyer cancel, restricted to pending_payment/paid. That
// restriction comes for free from the state machine itself ("cancelled" is
// only reachable from those two statuses) — transitionOrder's
// INVALID_ORDER_TRANSITION error already names the current status.
export async function cancelOwnedOrder(userId: string, orderId: string): Promise<OrderResponse> {
  const orderOid = toObjectId(orderId);
  const owned = await findOwned(orderOid, toObjectId(userId));
  if (!owned) throw orderNotFound();

  const updated = await transitionOrder(orderOid, "cancelled");
  return buildOrderResponse(updated);
}

export type AdminOrderResponse = OrderResponse & {
  buyer: { id: string; name: string; email: string } | null;
};

// FR-ORD-017 — every order across all buyers, paginated/sortable/status-
// filterable/searchable by order number or buyer email.
export async function listOrdersForAdmin(params: {
  page: number;
  limit: number;
  sort?: { field: OrderSortField; order: 1 | -1 };
  search?: string;
  status?: OrderStatus;
}): Promise<{ items: OrderResponse[]; pagination: Pagination }> {
  const filter: AdminOrderListFilter = {
    ...(params.status !== undefined ? { status: params.status } : {}),
    ...(params.search !== undefined ? { search: params.search } : {}),
  };
  const { items, total } = await listForAdmin(filter, params.sort, {
    page: params.page,
    limit: params.limit,
  });
  return {
    items: items.map(buildOrderResponse),
    pagination: buildPagination(params.page, params.limit, total),
  };
}

// FR-ORD-018 — identical shape to the buyer detail view plus the ordering
// buyer's identity.
export async function getOrderForAdmin(orderId: string): Promise<AdminOrderResponse> {
  const order = await findById(toObjectId(orderId));
  if (!order) throw orderNotFound();
  const buyer = await findBuyerIdentity(order.user);
  return { ...buildOrderResponse(order), buyer };
}

// FR-ORD-019 — advance along the legal state graph; an optional tracking
// reference is recorded specifically on the transition into `shipped`
// (transitionOrder records whatever's passed regardless of target status,
// so a tracking reference supplied on a non-shipped transition is simply
// stored too — the admin UI is expected to only ever send it on shipped,
// matching the SRS's own "optional ... on the transition into shipped"
// framing rather than this endpoint rejecting it outright on other moves).
export async function advanceOrderStatusForAdmin(
  orderId: string,
  toStatus: OrderStatus,
  trackingReference?: string,
): Promise<OrderResponse> {
  const updated = await transitionOrder(
    toObjectId(orderId),
    toStatus,
    trackingReference !== undefined ? { trackingReference } : undefined,
  );
  return buildOrderResponse(updated);
}

// FR-ORD-015 — admin cancellation, same status gate as buyer cancellation
// (via the identical transitionOrder/state-machine path), additionally
// requiring a reason (enforced by the controller's Zod schema).
export async function cancelOrderForAdmin(orderId: string, reason: string): Promise<OrderResponse> {
  const updated = await transitionOrder(toObjectId(orderId), "cancelled", {
    cancellationReason: reason,
  });
  return buildOrderResponse(updated);
}
