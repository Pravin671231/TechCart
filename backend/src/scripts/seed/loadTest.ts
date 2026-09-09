// FR-NFR-BE-005 — bulk synthetic dataset for the load-test baseline.
//
// ⚠️  RUN THIS AGAINST A THROWAWAY DATABASE, NOT YOUR NORMAL DEV DATA.
// Point MONGODB_URI at a dedicated database (e.g. .../techcart-loadtest) and
// drop it when you're done. The script refuses to run when NODE_ENV is
// "production" or when MONGODB_URI's host is not localhost/127.0.0.1, unless
// you pass --force.
//
//   MONGODB_URI=mongodb://localhost:27017/techcart-loadtest \
//     npm run seed:load-test --workspace backend -- --products=5000 --orders=10000
//
// Every document it writes is prefixed (slug `load-*`, sku `LOAD-*`,
// orderNumber `LOAD-*`, warehouse code `LOAD-WH-*`), and the script deletes
// its own prior output first, so it's safe to re-run. See
// backend/load-test/README.md for the full procedure.
import { Types } from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import { env } from "@/config/env";
import { computeSellingPrice } from "@/utils/pricing";
import { Brand } from "@/modules/product-catalog/features/brands/brands.model";
import { Category } from "@/modules/product-catalog/features/categories/categories.model";
import { CategorySpecifications } from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.model";
import {
  Product,
  type ProductDocument,
  type ProductVariant,
} from "@/modules/product-catalog/features/products/products.model";
import { Warehouse } from "@/modules/inventory/warehouses.model";
import { Inventory } from "@/modules/inventory/inventory.model";
import { Order, ORDER_STATUSES, type OrderDocument } from "@/modules/orders/orders.model";

const BRAND_COUNT = 8;
const CATEGORY_COUNT = 6;
const WAREHOUSE_CODES = ["LOAD-WH-1", "LOAD-WH-2", "LOAD-WH-3"] as const;
// Sprinkled through names/descriptions so `?q=` matches a realistic subset
// rather than everything or nothing.
const KEYWORDS = ["ultra", "pro", "max", "lite", "air", "plus", "mini", "edge"];
const SPEC_RAM = ["8GB", "16GB", "32GB"];

export interface LoadTestSeedOptions {
  products: number;
  orders: number;
  force?: boolean;
}

function assertSafeTarget(force: boolean): void {
  if (env.NODE_ENV === "production") {
    throw new Error("seed:load-test refuses to run with NODE_ENV=production");
  }
  const host = (() => {
    try {
      return new URL(env.MONGODB_URI.replace(/^mongodb\+srv:\/\//, "mongodb://")).hostname;
    } catch {
      return "";
    }
  })();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (!isLocal && !force) {
    throw new Error(
      `seed:load-test refuses to run against a non-local MONGODB_URI host (${host || "unknown"}). ` +
        "Point it at a throwaway localhost database, or pass --force if you really mean it.",
    );
  }
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length] as T;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function clearPriorOutput(): Promise<void> {
  const priorProducts = await Product.find({ slug: /^load-/ }, { _id: 1 }).lean();
  const priorCategories = await Category.find({ slug: /^load-/ }, { _id: 1 }).lean();

  await Inventory.deleteMany({ productId: { $in: priorProducts.map((p) => p._id) } });
  await CategorySpecifications.deleteMany({ category: { $in: priorCategories.map((c) => c._id) } });
  await Product.deleteMany({ slug: /^load-/ });
  await Category.deleteMany({ slug: /^load-/ });
  await Brand.deleteMany({ slug: /^load-/ });
  await Warehouse.deleteMany({ code: /^LOAD-WH-/ });
  await Order.deleteMany({ orderNumber: /^LOAD-/ });
}

async function seedWarehouses(): Promise<Types.ObjectId[]> {
  const ids: Types.ObjectId[] = [];
  for (const code of WAREHOUSE_CODES) {
    const wh = await Warehouse.create({ name: `Load Test ${code}`, code, active: true });
    ids.push(wh._id);
  }
  return ids;
}

async function seedBrands(): Promise<Types.ObjectId[]> {
  const docs = Array.from({ length: BRAND_COUNT }, (_, i) => ({
    name: `Load Brand ${i + 1}`,
    slug: `load-brand-${i + 1}`,
    status: true,
  }));
  const created = await Brand.insertMany(docs);
  return created.map((b) => b._id);
}

async function seedCategories(): Promise<Types.ObjectId[]> {
  const docs = Array.from({ length: CATEGORY_COUNT }, (_, i) => ({
    name: `Load Category ${i + 1}`,
    slug: `load-category-${i + 1}`,
    parentCategory: null,
    status: true,
    sortOrder: i,
    description: `Representative load-test category ${i + 1} for performance baselining.`,
  }));
  const created = await Category.insertMany(docs);
  const categoryIds = created.map((c) => c._id);

  await CategorySpecifications.insertMany(
    categoryIds.map((category) => ({
      category,
      specificationGroups: [
        {
          groupName: "Key Specs",
          specifications: [
            { name: "RAM", type: "enum", options: SPEC_RAM, required: false, filterable: true },
            { name: "Weight", type: "number", unit: "g", required: false, filterable: true },
            { name: "Warranty", type: "text", required: false, filterable: false },
          ],
        },
      ],
    })),
  );

  return categoryIds;
}

function buildVariants(productIndex: number): ProductVariant[] {
  const count = randInt(1, 3);
  const now = new Date();
  return Array.from({ length: count }, (_, v) => {
    const mrp = randInt(2000, 200000);
    const discount = randInt(0, 40);
    return {
      _id: new Types.ObjectId(),
      sku: `LOAD-SKU-${productIndex}-${v}`,
      attributes: [{ name: "RAM", value: pick(SPEC_RAM, productIndex + v) }],
      images: [{ url: "https://cdn.test.example/load.jpg", isPrimary: true }],
      mrp,
      discount,
      sellingPrice: computeSellingPrice(mrp, discount),
      active: true,
      createdAt: now,
      updatedAt: now,
    } satisfies ProductVariant;
  });
}

function buildProduct(
  i: number,
  brandIds: Types.ObjectId[],
  categoryIds: Types.ObjectId[],
): ProductDocument {
  const keyword = pick(KEYWORDS, i);
  // ~85% published so the buyer endpoints under test have a representative
  // working set; the rest exercise the status filter.
  const status = i % 20 === 0 ? "archived" : i % 7 === 0 ? "draft" : "published";
  return {
    name: `Load Test ${keyword} Product ${i}`,
    slug: `load-test-product-${i}`,
    description:
      `A representative ${keyword} product generated for load testing. ` +
      `It has a realistic-length description mentioning ${keyword} and other ` +
      `search terms so keyword search hits a meaningful fraction of the catalog. #${i}`,
    brand: pick(brandIds, i),
    category: pick(categoryIds, i),
    specifications: [
      {
        groupName: "Key Specs",
        values: [
          { name: "RAM", value: pick(SPEC_RAM, i) },
          { name: "Weight", value: randInt(150, 2500) },
          { name: "Warranty", value: "1 year" },
        ],
      },
    ],
    variants: buildVariants(i),
    isFeatured: i % 11 === 0,
    status,
  };
}

async function seedProducts(
  total: number,
  brandIds: Types.ObjectId[],
  categoryIds: Types.ObjectId[],
  warehouseIds: Types.ObjectId[],
): Promise<{ variantRefs: { productId: Types.ObjectId; variantId: Types.ObjectId; price: number }[] }> {
  const BATCH = 500;
  const variantRefs: { productId: Types.ObjectId; variantId: Types.ObjectId; price: number }[] = [];

  for (let start = 0; start < total; start += BATCH) {
    const batch: ProductDocument[] = [];
    for (let i = start; i < Math.min(start + BATCH, total); i += 1) {
      batch.push(buildProduct(i, brandIds, categoryIds));
    }
    const created = await Product.insertMany(batch, { ordered: false });

    const inventoryRows: {
      productId: Types.ObjectId;
      variantId: Types.ObjectId;
      warehouseId: Types.ObjectId;
      stock: number;
    }[] = [];
    created.forEach((doc, idx) => {
      const globalIndex = start + idx;
      doc.variants.forEach((variant) => {
        variantRefs.push({
          productId: doc._id,
          variantId: variant._id,
          price: variant.sellingPrice,
        });
        warehouseIds.forEach((warehouseId, whIdx) => {
          // Every 15th product fully out of stock; otherwise realistic stock.
          const stock = globalIndex % 15 === 0 ? 0 : randInt(5, 400) + whIdx * 10;
          inventoryRows.push({ productId: doc._id, variantId: variant._id, warehouseId, stock });
        });
      });
    });
    await Inventory.insertMany(inventoryRows, { ordered: false });

    process.stdout.write(
      `\r  products: ${Math.min(start + BATCH, total)}/${total}`,
    );
  }
  process.stdout.write("\n");

  return { variantRefs };
}

async function seedOrders(
  total: number,
  variantRefs: { productId: Types.ObjectId; variantId: Types.ObjectId; price: number }[],
): Promise<void> {
  if (total <= 0 || variantRefs.length === 0) return;
  const BATCH = 1000;
  const userPool = Array.from({ length: 50 }, () => new Types.ObjectId());
  const baseTime = Date.now();

  for (let start = 0; start < total; start += BATCH) {
    const batch: Partial<OrderDocument>[] = [];
    for (let i = start; i < Math.min(start + BATCH, total); i += 1) {
      const ref = variantRefs[randInt(0, variantRefs.length - 1)]!;
      const quantity = randInt(1, 4);
      const lineTotal = ref.price * quantity;
      const status = pick(ORDER_STATUSES, i);
      const at = new Date(baseTime - i * 60_000);
      batch.push({
        orderNumber: `LOAD-${i}`,
        user: pick(userPool, i),
        items: [
          {
            product: { id: ref.productId, name: `Load Test Product ${i}`, slug: `load-test-product-${i}` },
            variant: { id: ref.variantId, sku: `LOAD-SKU-${i}`, attributes: [], image: null },
            unitPrice: ref.price,
            quantity,
            lineTotal,
          },
        ],
        shippingAddress: {
          fullName: "Load Test Buyer",
          phone: "9000000000",
          line1: "1 Load Test Road",
          city: "Chennai",
          state: "Tamil Nadu",
          pincode: "600001",
        },
        totalAmount: lineTotal,
        status,
        statusHistory: [{ status, at }],
        createdAt: at,
        updatedAt: at,
      });
    }
    await Order.insertMany(batch, { ordered: false });
    process.stdout.write(`\r  orders: ${Math.min(start + BATCH, total)}/${total}`);
  }
  process.stdout.write("\n");
}

export async function runLoadTestSeed(options: LoadTestSeedOptions): Promise<void> {
  assertSafeTarget(options.force ?? false);

  console.log(
    `seed:load-test → ${env.MONGODB_URI}\n  target: ${options.products} products, ${options.orders} orders`,
  );

  console.log("clearing prior load-test output…");
  await clearPriorOutput();

  const warehouseIds = await seedWarehouses();
  const brandIds = await seedBrands();
  const categoryIds = await seedCategories();
  const { variantRefs } = await seedProducts(options.products, brandIds, categoryIds, warehouseIds);
  await seedOrders(options.orders, variantRefs);

  console.log(
    `done — ${brandIds.length} brands, ${categoryIds.length} categories, ` +
      `${options.products} products (${variantRefs.length} variants), ${options.orders} orders.`,
  );
}

function parseArg(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

if (require.main === module) {
  (async () => {
    await connectDB();
    try {
      await runLoadTestSeed({
        products: parseArg("products", 5000),
        orders: parseArg("orders", 10000),
        force: process.argv.includes("--force"),
      });
    } finally {
      await disconnectDB();
    }
  })()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("seed:load-test failed:", error);
      process.exit(1);
    });
}
