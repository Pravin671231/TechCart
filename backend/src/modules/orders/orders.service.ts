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
import { allocateOrderNumber } from "./orderNumber";
import { create, type OrderRecord } from "./orders.repository";
import type { OrderShippingAddress, OrderStatus } from "./orders.model";

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

  return {
    ...buildOrderResponse(order),
    ...(droppedItems.length > 0 ? { droppedItems } : {}),
  };
}
