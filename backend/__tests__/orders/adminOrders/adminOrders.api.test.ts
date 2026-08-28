import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

// M5 / Issue #158 — admin order management, real DB (search-by-buyer-email
// needs a real `users` lookup, and the role boundary needs real sessions),
// same rationale every other orders suite in this milestone documents.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import { transitionOrder } from "@/modules/orders/orders.service";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const ORDER_MANAGER_EMAIL = "admin-orders-order-manager@example.com";
const ORDER_MANAGER_PASSWORD = "OrderMgr!Pass1";
const CATALOG_MANAGER_EMAIL = "admin-orders-catalog-manager@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";
const BUYER_EMAIL = "admin-orders-buyer@example.com";

let ctx: MemoryMongoContext;
let app: Express;
let orderManagerToken: string;
let catalogManagerToken: string;
let buyerToken: string;

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
  await authRequest(app, "post", "/api/cart/items", buyerToken).send({
    variantId: variantId.toString(),
    quantity: 1,
  });
  const res = await authRequest(app, "post", "/api/orders", buyerToken).send({
    shippingAddress: validAddress,
  });
  const id = res.body.data.id as string;
  return { id, _idOid: new Types.ObjectId(id) };
}

function admin(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, orderManagerToken);
}

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;

  const { provisionAdminUser } = await import("../../../src/scripts/seed/createAdminUser.js");
  await provisionAdminUser({
    email: ORDER_MANAGER_EMAIL,
    password: ORDER_MANAGER_PASSWORD,
    name: "Order Manager Fixture",
    role: "order-manager",
  });
  orderManagerToken = await signInFully(app, ORDER_MANAGER_EMAIL, ORDER_MANAGER_PASSWORD);

  await provisionAdminUser({
    email: CATALOG_MANAGER_EMAIL,
    password: CATALOG_MANAGER_PASSWORD,
    name: "Catalog Manager Fixture",
    role: "catalog-manager",
  });
  catalogManagerToken = await signInFully(app, CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);

  buyerToken = await signInBuyer(app, BUYER_EMAIL);
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("role boundary (FR-ORD-020)", () => {
  it("rejects a catalog-manager session 403 on every /api/admin/orders/* route", async () => {
    const { id } = await seedOrder();

    for (const [method, url] of [
      ["get", "/api/admin/orders"],
      ["get", `/api/admin/orders/${id}`],
      ["patch", `/api/admin/orders/${id}/status`],
      ["post", `/api/admin/orders/${id}/cancel`],
    ] as const) {
      const res = await authRequest(app, method, url, catalogManagerToken).send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    }
  });
});

describe("GET /api/admin/orders (FR-ORD-017)", () => {
  it("lists every order across all buyers, filterable by status", async () => {
    const first = await seedOrder();
    await seedOrder();
    await transitionOrder(first._idOid, "paid");

    const all = await admin("get", "/api/admin/orders");
    expect(all.body.data).toHaveLength(2);

    const paidOnly = await admin("get", "/api/admin/orders?status=paid");
    expect(paidOnly.body.data).toHaveLength(1);
    expect(paidOnly.body.data[0].id).toBe(first.id);
  });

  it("searches by order number", async () => {
    const { id } = await seedOrder();
    const detail = await admin("get", `/api/admin/orders/${id}`);
    const orderNumber = detail.body.data.orderNumber as string;

    const res = await admin("get", `/api/admin/orders?search=${orderNumber}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(id);
  });

  it("searches by buyer email", async () => {
    await seedOrder();

    const res = await admin("get", `/api/admin/orders?search=${BUYER_EMAIL}`);

    expect(res.body.data).toHaveLength(1);
  });
});

describe("GET /api/admin/orders/:id (FR-ORD-018)", () => {
  it("returns full detail plus the ordering buyer's identity", async () => {
    const { id } = await seedOrder();

    const res = await admin("get", `/api/admin/orders/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.buyer).toMatchObject({ email: BUYER_EMAIL });
  });
});

describe("PATCH /api/admin/orders/:id/status (FR-ORD-019)", () => {
  it("advances status along the legal graph and records a tracking reference on shipped", async () => {
    const { id, _idOid } = await seedOrder();
    await transitionOrder(_idOid, "paid");

    const toProcessing = await admin("patch", `/api/admin/orders/${id}/status`).send({
      status: "processing",
    });
    expect(toProcessing.status).toBe(200);
    expect(toProcessing.body.data.status).toBe("processing");

    const toShipped = await admin("patch", `/api/admin/orders/${id}/status`).send({
      status: "shipped",
      trackingReference: "TRACK123",
    });
    expect(toShipped.status).toBe(200);
    expect(toShipped.body.data.trackingReference).toBe("TRACK123");
  });

  it("rejects an illegal transition", async () => {
    const { id } = await seedOrder();

    const res = await admin("patch", `/api/admin/orders/${id}/status`).send({
      status: "shipped",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_ORDER_TRANSITION");
  });
});

describe("POST /api/admin/orders/:id/cancel (FR-ORD-015)", () => {
  it("requires a reason", async () => {
    const { id } = await seedOrder();

    const res = await admin("post", `/api/admin/orders/${id}/cancel`).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("cancels with a reason, under the same status gate as buyer cancellation", async () => {
    const { id } = await seedOrder();

    const res = await admin("post", `/api/admin/orders/${id}/cancel`).send({
      reason: "Buyer requested cancellation by phone.",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cancelled");
    expect(res.body.data.cancellationReason).toBe("Buyer requested cancellation by phone.");
  });
});
