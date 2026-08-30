// CLI entry point for seed orders + payments (Issue #330) — run with
// `npm run seed:orders --workspace backend` (add `--reset` to rebuild only
// the seed buyers' own orders/payments). Idempotent, matching upsert.ts's/
// seedUsers.ts's precedent over run.ts's destructive full-reset one.
//
// Depends on seed:upsert (published products with active variants) and
// seed:users (the 3 sample buyers) already having been run. Builds 7 orders
// across the 3 seed buyers, spanning every ORDER_STATUSES value exactly
// once, by walking orders.stateMachine.ts's real transition table via
// orders.repository.ts's create()/updateStatus() directly — deliberately
// NEVER orders.service.ts's transitionOrder(), since that dynamically
// imports orders.notifications.ts and enqueues a BullMQ email; not calling
// transitionOrder at all means that import (and the enqueue) never executes,
// no mocking required. For every order reaching "paid" or later, a matching
// Payment document is inserted the same way — payments.repository.ts's
// create()/markCaptured()/addRefund() directly, never payments.service.ts's
// initiatePayment()/verifyPayment()/refundOrder(), which call the real
// Razorpay SDK.
import mongoose, { Types } from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import {
  Order,
  type OrderItemSnapshot,
  type OrderShippingAddress,
  type OrderStatus,
} from "@/modules/orders/orders.model";
import * as ordersRepository from "@/modules/orders/orders.repository";
import { allocateOrderNumber } from "@/modules/orders/orderNumber";
import { assertTransition } from "@/modules/orders/orders.stateMachine";
import { Payment } from "@/modules/payments/payments.model";
import * as paymentsRepository from "@/modules/payments/payments.repository";
import { Product } from "@/modules/product-catalog/features/products/products.model";
import { SAMPLE_BUYERS } from "./seedUsers";

type SeedBuyer = { id: Types.ObjectId; email: string; name: string };

async function resolveSeedBuyers(): Promise<SeedBuyer[]> {
  const usersCollection = mongoose.connection.db!.collection("users");
  const emails = SAMPLE_BUYERS.map((b) => b.email);
  const docs = await usersCollection
    .find({ email: { $in: emails } })
    .project({ name: 1, email: 1 })
    .toArray();

  const byEmail = new Map(docs.map((d) => [d.email as string, d]));
  const buyers: SeedBuyer[] = [];
  for (const sample of SAMPLE_BUYERS) {
    const doc = byEmail.get(sample.email);
    if (!doc) {
      throw new Error(
        `Seed buyer ${sample.email} not found — run \`npm run seed:users --workspace backend\` first.`,
      );
    }
    buyers.push({
      id: doc._id as Types.ObjectId,
      email: sample.email,
      name: (doc.name as string) ?? sample.name,
    });
  }
  return buyers;
}

type CatalogItem = {
  product: { id: Types.ObjectId; name: string; slug: string };
  variant: {
    id: Types.ObjectId;
    sku: string;
    attributes: { name: string; value: string }[];
    image: { url: string; alt?: string } | null;
    sellingPrice: number;
  };
};

async function resolveCatalogItems(): Promise<CatalogItem[]> {
  const products = await Product.find({ status: "published" }).lean();
  const items: CatalogItem[] = [];
  for (const product of products) {
    const variant = product.variants.find((v) => v.active);
    if (!variant) continue;
    const primaryImage = variant.images.find((img) => img.isPrimary) ?? variant.images[0] ?? null;
    items.push({
      product: { id: product._id, name: product.name, slug: product.slug },
      variant: {
        id: variant._id,
        sku: variant.sku,
        attributes: variant.attributes,
        image: primaryImage
          ? { url: primaryImage.url, ...(primaryImage.alt ? { alt: primaryImage.alt } : {}) }
          : null,
        sellingPrice: variant.sellingPrice,
      },
    });
  }
  if (items.length === 0) {
    throw new Error(
      "No published product with an active variant found — run `npm run seed:upsert --workspace backend` first.",
    );
  }
  return items;
}

function buildShippingAddress(buyer: SeedBuyer): OrderShippingAddress {
  return {
    fullName: buyer.name,
    phone: "9876543210",
    line1: "221B, Residency Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560025",
  };
}

function buildItem(catalog: CatalogItem[], index: number, quantity: number): OrderItemSnapshot {
  const entry = catalog[index % catalog.length]!;
  const unitPrice = entry.variant.sellingPrice;
  return {
    product: entry.product,
    variant: {
      id: entry.variant.id,
      sku: entry.variant.sku,
      attributes: entry.variant.attributes,
      image: entry.variant.image,
    },
    unitPrice,
    quantity,
    lineTotal: unitPrice * quantity,
  };
}

type OrderPlan = {
  buyerIndex: 0 | 1 | 2;
  targetStatus: OrderStatus;
  walk: OrderStatus[];
  trackingReference?: string;
  cancellationReason?: string;
};

// Deterministic — every ORDER_STATUSES value appears exactly once across the
// 3 seed buyers (2/2/3), each walk using only legal orders.stateMachine.ts
// transitions.
const ORDER_PLANS: OrderPlan[] = [
  { buyerIndex: 0, targetStatus: "pending_payment", walk: [] },
  { buyerIndex: 0, targetStatus: "paid", walk: ["paid"] },
  { buyerIndex: 1, targetStatus: "processing", walk: ["paid", "processing"] },
  {
    buyerIndex: 1,
    targetStatus: "cancelled",
    walk: ["cancelled"],
    cancellationReason: "Seed data — customer changed their mind.",
  },
  {
    buyerIndex: 2,
    targetStatus: "shipped",
    walk: ["paid", "processing", "shipped"],
    trackingReference: "SEED-TRACK-001",
  },
  {
    buyerIndex: 2,
    targetStatus: "delivered",
    walk: ["paid", "processing", "shipped", "delivered"],
  },
  { buyerIndex: 2, targetStatus: "refunded", walk: ["paid", "refunded"] },
];

const PAID_OR_LATER: readonly OrderStatus[] = [
  "paid",
  "processing",
  "shipped",
  "delivered",
  "refunded",
];

async function seedOneOrder(
  plan: OrderPlan,
  buyer: SeedBuyer,
  catalog: CatalogItem[],
  index: number,
): Promise<void> {
  const quantity = (index % 2) + 1;
  const items = [buildItem(catalog, index, quantity)];
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

  const order = await ordersRepository.create({
    orderNumber: await allocateOrderNumber(),
    user: buyer.id,
    items,
    shippingAddress: buildShippingAddress(buyer),
    totalAmount,
    status: "pending_payment",
    statusHistory: [{ status: "pending_payment", at: new Date() }],
  });

  let current: OrderStatus = "pending_payment";
  for (let hopIndex = 0; hopIndex < plan.walk.length; hopIndex += 1) {
    const next = plan.walk[hopIndex]!;
    const isLastHop = hopIndex === plan.walk.length - 1;
    assertTransition(current, next);
    await ordersRepository.updateStatus(
      order._id,
      next,
      { status: next, at: new Date() },
      isLastHop
        ? {
            ...(plan.trackingReference ? { trackingReference: plan.trackingReference } : {}),
            ...(plan.cancellationReason ? { cancellationReason: plan.cancellationReason } : {}),
          }
        : undefined,
    );
    current = next;
  }

  if (!PAID_OR_LATER.includes(plan.targetStatus)) return;

  const amountPaise = Math.round(totalAmount * 100);
  const payment = await paymentsRepository.create({
    order: order._id,
    razorpayOrderId: `seed_rzp_order_${order.orderNumber}`,
    amount: amountPaise,
    currency: "INR",
    status: "created",
  });
  await paymentsRepository.markCaptured(payment._id, {
    razorpayPaymentId: `seed_rzp_pay_${order.orderNumber}`,
  });

  if (plan.targetStatus === "refunded") {
    await paymentsRepository.addRefund(
      payment._id,
      {
        razorpayRefundId: `seed_rzp_refund_${order.orderNumber}`,
        amount: amountPaise,
        reason: "Seed data — full refund example.",
        status: "processed",
        createdAt: new Date(),
      },
      "refunded",
    );
  }
}

export async function runSeedOrders(options?: { reset?: boolean }): Promise<void> {
  const buyers = await resolveSeedBuyers();
  const buyerIds = buyers.map((b) => b.id);

  const alreadySeeded = await Order.exists({ user: { $in: buyerIds } });
  if (alreadySeeded && !options?.reset) {
    console.log("Seed orders already exist — skipping (pass --reset to rebuild).");
    return;
  }

  if (alreadySeeded && options?.reset) {
    const existingOrders = await Order.find({ user: { $in: buyerIds } }, { _id: 1 }).lean();
    const orderIds = existingOrders.map((o) => o._id);
    await Payment.deleteMany({ order: { $in: orderIds } });
    await Order.deleteMany({ user: { $in: buyerIds } });
    console.log(`Reset: removed ${orderIds.length} existing seed order(s) and their payments.`);
  }

  const catalog = await resolveCatalogItems();

  for (let i = 0; i < ORDER_PLANS.length; i += 1) {
    const plan = ORDER_PLANS[i]!;
    const buyer = buyers[plan.buyerIndex]!;
    await seedOneOrder(plan, buyer, catalog, i);
    console.log(
      `Seeded order ${i + 1}/${ORDER_PLANS.length}: ${plan.targetStatus} (buyer ${buyer.email})`,
    );
  }

  console.log(
    `Orders seed complete: ${ORDER_PLANS.length} order(s) across ${buyers.length} buyer(s).`,
  );
}

if (require.main === module) {
  connectDB()
    .then(() => runSeedOrders({ reset: process.argv.includes("--reset") }))
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("seed:orders failed:", error);
      process.exit(1);
    });
}
