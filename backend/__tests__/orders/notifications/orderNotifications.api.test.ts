import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M5 / Issue #159 — order-confirmation/order-status emails are fired from
// real checkout()/transitionOrder() calls (real DB, same rationale every
// other orders suite documents). Since the Redis/BullMQ removal these are
// sent inline, fire-and-forget, via @/externalService/mailer — mocked here
// so the suite can assert exactly what got sent without a real mail
// provider. The send is not awaited by the caller, so assertions use
// vi.waitFor and each test settles prior sends before clearing mocks.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
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
const WAIT = { timeout: 5000 };

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

// Creates an order via the real checkout flow and waits for its
// fire-and-forget confirmation email to have been dispatched, so a caller
// can vi.clearAllMocks() straight after with no in-flight send bleeding in.
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
  await vi.waitFor(() => {
    expect(mailer.sendOrderConfirmationEmail).toHaveBeenCalled();
  }, WAIT);
  return { id, _idOid: new Types.ObjectId(id) };
}

// Advances an order through a chain of transitions and waits for each
// notifiable one's fire-and-forget email to settle.
async function advance(orderId: Types.ObjectId, ...statuses: string[]): Promise<void> {
  const NOTIFIABLE = new Set(["paid", "shipped", "delivered", "cancelled"]);
  let expected = 0;
  for (const status of statuses) {
    await transitionOrder(orderId, status as never);
    if (NOTIFIABLE.has(status)) {
      expected += 1;
      await vi.waitFor(() => {
        expect(mailer.sendOrderStatusEmail).toHaveBeenCalledTimes(expected);
      }, WAIT);
    }
  }
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
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("checkout / FR-ORD-021", () => {
  it("sends exactly one order-confirmation email, without the request waiting on it", async () => {
    await seedOrder();

    expect(mailer.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      BUYER_EMAIL,
      expect.objectContaining({ orderNumber: expect.any(String) }),
    );
  });
});

describe("transitionOrder / FR-ORD-022", () => {
  it("sends an order-status email when reaching paid", async () => {
    const { _idOid } = await seedOrder();
    vi.clearAllMocks();

    await advance(_idOid, "paid");

    expect(mailer.sendOrderStatusEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendOrderStatusEmail).toHaveBeenCalledWith(BUYER_EMAIL, expect.any(String), "paid");
  });

  it("sends an order-status email when reaching shipped", async () => {
    const { _idOid } = await seedOrder();
    await advance(_idOid, "paid", "processing");
    vi.clearAllMocks();

    await advance(_idOid, "shipped");

    expect(mailer.sendOrderStatusEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendOrderStatusEmail).toHaveBeenCalledWith(
      BUYER_EMAIL,
      expect.any(String),
      "shipped",
    );
  });

  it("sends an order-status email when reaching delivered", async () => {
    const { _idOid } = await seedOrder();
    await advance(_idOid, "paid", "processing", "shipped");
    vi.clearAllMocks();

    await advance(_idOid, "delivered");

    expect(mailer.sendOrderStatusEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendOrderStatusEmail).toHaveBeenCalledWith(
      BUYER_EMAIL,
      expect.any(String),
      "delivered",
    );
  });

  it("sends an order-status email when cancelled", async () => {
    const { _idOid } = await seedOrder();
    vi.clearAllMocks();

    await advance(_idOid, "cancelled");

    expect(mailer.sendOrderStatusEmail).toHaveBeenCalledWith(
      BUYER_EMAIL,
      expect.any(String),
      "cancelled",
    );
  });

  it("does not send anything for a non-notifiable status (processing)", async () => {
    const { _idOid } = await seedOrder();
    await advance(_idOid, "paid");
    vi.clearAllMocks();

    await transitionOrder(_idOid, "processing");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mailer.sendOrderStatusEmail).not.toHaveBeenCalled();
  });

  it("a transition succeeds independent of the email send failing", async () => {
    const { _idOid } = await seedOrder();
    vi.mocked(mailer.sendOrderStatusEmail).mockRejectedValueOnce(new Error("mail provider down"));

    const updated = await transitionOrder(_idOid, "paid");
    expect(updated.status).toBe("paid");
  });
});

describe("send implementations", () => {
  it("processOrderConfirmationJob sends the confirmation email", async () => {
    const { id } = await seedOrder();
    vi.clearAllMocks();

    await processOrderConfirmationJob({ orderId: id });

    expect(mailer.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      BUYER_EMAIL,
      expect.objectContaining({ orderNumber: expect.any(String) }),
    );
  });

  it("processOrderStatusJob sends the status email", async () => {
    const { id, _idOid } = await seedOrder();
    await advance(_idOid, "paid");
    vi.clearAllMocks();

    await processOrderStatusJob({ orderId: id, status: "paid" });

    expect(mailer.sendOrderStatusEmail).toHaveBeenCalledWith(BUYER_EMAIL, expect.any(String), "paid");
  });
});
