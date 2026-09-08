import { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// SRS v0.2 amendment (FR-CAT-105/106) — real-DB verification of the buyer flat
// listing's ordering guarantees, which every other products suite skips
// (products.api.test.ts mocks the repository; search.integration.test.ts needs
// a live Atlas cluster). No repository mock here: the actual `listPublicPaginated`
// aggregation runs against mongodb-memory-server.
//
// - FR-CAT-106: every buyer sort is a *total* order, so splitting one fetch into
//   consecutive infinite-scroll pages yields exactly the same sequence as one
//   big fetch — no overlap, no dropped items, stable across refetches.
// - FR-CAT-105: `sort=recommended` interleaves published products across their
//   categories (round-robin by within-category newest rank).
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { Product } from "@/modules/product-catalog/features/products/products.model";
import { Brand } from "@/modules/product-catalog/features/brands/brands.model";
import { Category } from "@/modules/product-catalog/features/categories/categories.model";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

let ctx: MemoryMongoContext;
let app: Express;

const D = (iso: string) => new Date(iso);

// name → category key → primary-variant createdAt. Four products share the
// newest timestamp (2024-01-03) to force ties `_id` must break; "C-ghost" has
// only an inactive variant, so its `sortCreatedAt` resolves to null.
const FIXTURES: { name: string; cat: "A" | "B" | "C"; createdAt: Date; ghost?: boolean }[] = [
  { name: "A-alpha", cat: "A", createdAt: D("2024-01-03T00:00:00Z") },
  { name: "A-beta", cat: "A", createdAt: D("2024-01-03T00:00:00Z") },
  { name: "A-gamma", cat: "A", createdAt: D("2024-01-01T00:00:00Z") },
  { name: "B-alpha", cat: "B", createdAt: D("2024-01-03T00:00:00Z") },
  { name: "B-beta", cat: "B", createdAt: D("2024-01-02T00:00:00Z") },
  { name: "C-alpha", cat: "C", createdAt: D("2024-01-03T00:00:00Z") },
  { name: "C-ghost", cat: "C", createdAt: D("2024-01-03T00:00:00Z"), ghost: true },
];

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;

  const brand = await Brand.create({ name: "Listing Brand", slug: "listing-brand" });
  const cats: Record<"A" | "B" | "C", Types.ObjectId> = {
    A: (await Category.create({ name: "Listing Cat A", slug: "listing-cat-a" }))._id,
    B: (await Category.create({ name: "Listing Cat B", slug: "listing-cat-b" }))._id,
    C: (await Category.create({ name: "Listing Cat C", slug: "listing-cat-c" }))._id,
  };
  const products = ctx.mongoose.connection.db!.collection("products");

  for (const fixture of FIXTURES) {
    const product = await Product.create({
      name: fixture.name,
      slug: `listing-${fixture.name.toLowerCase()}`,
      description: `${fixture.name} fixture`,
      brand: brand._id,
      category: cats[fixture.cat],
      specifications: [],
      isFeatured: false,
      status: "published",
      variants: [
        {
          sku: `LIST-${fixture.name}`,
          attributes: [{ name: "Color", value: "Black" }],
          images: [{ url: "https://cdn.test.example/x.webp", isPrimary: true }],
          mrp: 10000,
          discount: 0,
          sellingPrice: 10000,
          active: !fixture.ghost,
        },
      ],
    });
    // Mongoose's subdocument `{ timestamps: true }` stamps `createdAt` at
    // create-time regardless of any value passed in — force the fixture value
    // through the raw driver, the same escape hatch replaceVariants() uses.
    await products.updateOne(
      { _id: product._id },
      { $set: { "variants.$[].createdAt": fixture.createdAt } },
    );
  }
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

type Item = { _id: string; name: string };

async function list(query: Record<string, string | number>): Promise<Item[]> {
  const res = await request(app).get("/api/products").query(query);
  expect(res.status).toBe(200);
  return res.body.data as Item[];
}

describe("GET /api/products — ordering guarantees (FR-CAT-105/106)", () => {
  it("reports every published product, ghost variant included", async () => {
    const res = await request(app).get("/api/products").query({ limit: 50 });
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(FIXTURES.length);
  });

  for (const sort of ["newest", "price_asc", "recommended"] as const) {
    it(`\`sort=${sort}\` splits into pages identically to one whole fetch (FR-CAT-106)`, async () => {
      const whole = await list({ sort, limit: 50 });
      const page1 = await list({ sort, page: 1, limit: 3 });
      const page2 = await list({ sort, page: 2, limit: 3 });
      const page3 = await list({ sort, page: 3, limit: 3 });

      const paged = [...page1, ...page2, ...page3].map((item) => item._id);
      expect(paged).toEqual(whole.map((item) => item._id));

      // no page overlaps another
      expect(new Set(paged).size).toBe(paged.length);
    });

    it(`\`sort=${sort}\` returns a stable order across refetches (FR-CAT-106)`, async () => {
      const first = await list({ sort, limit: 50 });
      const second = await list({ sort, limit: 50 });
      expect(second.map((item) => item._id)).toEqual(first.map((item) => item._id));
    });
  }

  it("`sort=recommended` interleaves across categories (FR-CAT-105)", async () => {
    const items = await list({ sort: "recommended", limit: 50 });
    // Product names are `<CategoryLetter>-<x>` — the first three items (rank 1
    // of each of the three categories) must span all three categories, not
    // three products from one.
    const firstThreeCategories = items.slice(0, 3).map((item) => item.name[0]);
    expect(new Set(firstThreeCategories)).toEqual(new Set(["A", "B", "C"]));
  });

  it("`sort=recommended` on a category-scoped listing falls back to newest", async () => {
    // The dedicated category route never interleaves (one category) — it must
    // still return a well-ordered page, not error on the unexpected sort value.
    const res = await request(app)
      .get("/api/categories/listing-cat-a/products")
      .query({ sort: "recommended", limit: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data.map((item: Item) => item.name)).toEqual(["A-alpha", "A-beta", "A-gamma"]);
  });
});
