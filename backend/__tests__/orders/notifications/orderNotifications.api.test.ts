import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M5 / Issue #159 — order-confirmation/order-status jobs are enqueued from
// real checkout()/transitionOrder() calls (real DB, same rationale every
// other orders suite documents), with @/lib/queue mocked so this suite can
// assert exactly what got enqueued without needing a real Redis connection.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
}));

// vi.mock factories are hoisted above every top-level statement, including
// a plain `const mockAdd = vi.fn()` declared earlier in this file — a
// `mock`-prefixed name only satisfies Vitest's static check, it doesn't
// change *when* the factory runs, so referencing a not-yet-initialized
// plain const throws a real TDZ error at runtime. vi.hoisted() is the
// actual fix: it hoists the value itself alongside the mock.
const { mockAdd } = vi.hoisted(() => ({ mockAdd: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/queue", () => ({
  connection: null,
  warnQueueDisabledOnce: vi.fn(),
  QUEUE_NAMES: { ORDER_LIFECYCLE: "order-lifecycle", ORDER_NOTIFICATIONS: "order-notifications" },
  orderLifecycleQueue: null,
  orderNotificationsQueue: { add: mockAdd },
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import { transitionOrder } from "@/modules/orders/orders.service";
import {
  processOrderConfirmationJob,
  processOrderStatusJob,
} from "@/modules/orders/orders.notifications";
import * as mailer from "@/externalService/mailer";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  authRequest,
  seedTestWarehouseStock,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const BUYER_EMAIL = "notifications-buyer@example.com";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;

const validAddress = {
  fullName: "Asha Rao",
  phone: "9876543210",
  line1: "221B, Residency Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560025",
};

async function seedOrder(): Promise<{ id: string; _idOid: Types.ObjectId }> {
  const product = await Product.create({
    name: "Nova X5 Pro 5G",
    slug: `nova-${new Types.ObjectId().toString()}`,
    description: "A phone.",
    brand: new Types.ObjectId(),
    category: new Types.ObjectId(),
    specifications: [],
    isFeatured: false,
    status: "published",
    variants: [
      {
        sku: `SKU-${new Types.ObjectId().toString()}`,
        attributes: [{ name: "Color", value: "Black" }],
        images: [{ url: "https://cdn.test/a.webp", alt: "A", isPrimary: true }],
        mrp: 5000000,
        discount: 20,
        sellingPrice: 4000000,
        active: true,
      },
    ],
  });
  const variantId = product.variants[0]!._id;
  await seedTestWarehouseStock(product._id, [variantId]);
  await authRequest(app, "post", "/api/cart/items", token).send({
    variantId: variantId.toString(),
    quantity: 1,
  });
  const res = await authRequest(app, "post", "/api/orders", token).send({
    shippingAddress: validAddress,
  });
  const id = res.body.data.id as string;
  return { id, _idOid: new Types.ObjectId(id) };
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;
  token = await signInBuyer(app, BUYER_EMAIL);
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

beforeEach(async () => {
  await ctx.mongoose.connection.db!.collection("carts").deleteMany({});
  await ctx.mongoose.connection.db!.collection("products").deleteMany({});
  await ctx.mongoose.connection.db!.collection("addresses").deleteMany({});
  await ctx.mongoose.connection.db!.collection("orders").deleteMany({});
  await ctx.mongoose.connection.db!.collection("counters").deleteMany({});
  mockAdd.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("checkout / FR-ORD-021", () => {
  it("enqueues exactly one order-confirmation job, without waiting on it sending", async () => {
    await seedOrder();

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(
      "order-confirmation",
      expect.objectContaining({ orderId: expect.any(String) }),
      expect.anything(),
    );
  });
});

describe("transitionOrder / FR-ORD-022", () => {
  it.each(["paid", "shipped", "delivered"] as const)(
    "enqueues its own order-status job when reaching %s",
    async (status) => {
      const { _idOid } = await seedOrder();
      mockAdd.mockClear();

      if (status === "shipped") {
        await transitionOrder(_idOid, "paid");
        mockAdd.mockClear();
        await transitionOrder(_idOid, "processing");
        mockAdd.mockClear();
      } else if (status === "delivered") {
        await transitionOrder(_idOid, "paid");
        await transitionOrder(_idOid, "processing");
        await transitionOrder(_idOid, "shipped");
        mockAdd.mockClear();
      }

      await transitionOrder(_idOid, status);

      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockAdd).toHaveBeenCalledWith(
        "order-status",
        expect.objectContaining({ orderId: _idOid.toString(), status }),
        expect.anything(),
      );
    },
  );

  it("enqueues an order-status job when cancelled", async () => {
    const { _idOid } = await seedOrder();
    mockAdd.mockClear();

    await transitionOrder(_idOid, "cancelled");

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(
      "order-status",
      expect.objectContaining({ status: "cancelled" }),
      expect.anything(),
    );
  });

  it("does not enqueue anything for a non-notifiable status (processing)", async () => {
    const { _idOid } = await seedOrder();
    await transitionOrder(_idOid, "paid");
    mockAdd.mockClear();

    await transitionOrder(_idOid, "processing");

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("a transition succeeds independent of the enqueue call failing", async () => {
    mockAdd.mockRejectedValueOnce(new Error("redis unreachable"));
    const { _idOid } = await seedOrder();

    // seedOrder's own checkout call is where the rejected enqueue landed;
    // the order still exists and is pending_payment, checkout didn't throw.
    const updated = await transitionOrder(_idOid, "paid");
    expect(updated.status).toBe("paid");
  });
});

describe("worker processors", () => {
  it("processOrderConfirmationJob sends the confirmation email", async () => {
    const { id } = await seedOrder();

    await processOrderConfirmationJob({ orderId: id });

    expect(mailer.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      BUYER_EMAIL,
      expect.objectContaining({ orderNumber: expect.any(String) }),
    );
  });

  it("processOrderStatusJob sends the status email", async () => {
    const { id, _idOid } = await seedOrder();
    await transitionOrder(_idOid, "paid");

    await processOrderStatusJob({ orderId: id, status: "paid" });

    expect(mailer.sendOrderStatusEmail).toHaveBeenCalledWith(
      BUYER_EMAIL,
      expect.any(String),
      "paid",
    );
  });
});
