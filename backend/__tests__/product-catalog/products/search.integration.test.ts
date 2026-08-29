import type { Express } from "express";
import type mongooseType from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
// Models import only mongoose (no @/config/env), so they're safe as static
// imports; connectDB / app / the ensure script all pull in @/config/env, which
// freezes MONGODB_URI at load — those stay dynamic, imported after beforeAll
// sets the real URI (same reasoning as testHelpers/adminSession.ts).
import { Brand } from "@/modules/product-catalog/features/brands/brands.model";
import { Category } from "@/modules/product-catalog/features/categories/categories.model";
import { Product } from "@/modules/product-catalog/features/products/products.model";

// Real end-to-end verification of the Atlas `$search` path
// (products.repository.ts's searchPublicPaginated / buildSearchFilters) against
// a live mongot — the first test that actually exercises the `embeddedDocument`
// operator shape rather than asserting a mocked call.
//
// Runs ONLY when ATLAS_SEARCH_TEST_URI is set (CI sets it from a repo secret
// pointing at a dedicated free Atlas M0; local `npm test` skips this file).
// Uses a fixed database name so leaked Atlas Search indexes can't accumulate
// past the M0 free-tier cap; beforeAll drops it, so a prior failed run
// self-heals. Concurrent CI runs of different PRs share it — an accepted rare
// flake for this repo's single-maintainer workflow.
const TEST_URI = process.env.ATLAS_SEARCH_TEST_URI;
const TEST_DB = "atlas_search_ci";

const HOOK_TIMEOUT_MS = 480_000; // M0 search-index build + mongot catch-up
const CASE_TIMEOUT_MS = 90_000;

function uriWithDb(uri: string, db: string): string {
  const url = new URL(uri);
  url.pathname = `/${db}`;
  return url.toString();
}

describe.skipIf(!TEST_URI)("GET /api/products — Atlas Search ($search) end to end", () => {
  let mongoose: typeof mongooseType;
  let app: Express;

  // Product/variant/spec fixtures. Two "phones" and one "tablet"; Color Red on
  // Alpha + Gamma, Blue on Beta; RAM 8GB on Alpha + Gamma, 16GB on Beta;
  // Weight spans a range so a spec range filter can bracket exactly two.
  const products = [
    { name: "Alpha Phone", sku: "ATLAS-IT-A1", color: "Red", ram: "8GB", weight: 150 },
    { name: "Beta Phone", sku: "ATLAS-IT-B1", color: "Blue", ram: "16GB", weight: 250 },
    { name: "Gamma Tablet", sku: "ATLAS-IT-C1", color: "Red", ram: "8GB", weight: 180 },
  ];

  beforeAll(async () => {
    process.env.MONGODB_URI = uriWithDb(TEST_URI as string, TEST_DB);

    // Dynamic, relative-with-.js imports (mirroring
    // __tests__/testHelpers/adminSession.ts): MONGODB_URI must be set before
    // @/config/env — which db.ts/app.ts pull in at load — is ever evaluated,
    // and tsc under module:NodeNext resolves path-mapped specifiers only in
    // static/type position, not a value-position dynamic import().
    mongoose = (await import("mongoose")).default;
    const { connectDB } = await import("../../../src/config/db.js");
    await connectDB({ serverSelectionTimeoutMS: 60_000 });
    await mongoose.connection.dropDatabase();

    const brand = await Brand.create({ name: "Atlas Test Brand", slug: "atlas-test-brand" });
    const category = await Category.create({
      name: "Atlas Test Category",
      slug: "atlas-test-category",
    });

    for (const p of products) {
      await Product.create({
        name: p.name,
        slug: p.name.toLowerCase().replace(/\s+/g, "-"),
        description: `${p.name} — integration test fixture`,
        brand: brand._id,
        category: category._id,
        specifications: [
          {
            groupName: "Technical",
            values: [
              { name: "RAM", value: p.ram },
              { name: "Weight", value: p.weight },
            ],
          },
        ],
        status: "published",
        variants: [
          {
            sku: p.sku,
            attributes: [{ name: "Color", value: p.color }],
            images: [{ url: "https://cdn.test.example/x.jpg", isPrimary: true }],
            mrp: 20000,
            discount: 0,
            sellingPrice: 20000,
            active: true,
          },
        ],
      });
    }

    const { ensureProductsSearchIndex } = await import(
      "../../../src/scripts/searchIndexes/ensureSearchIndexes.js"
    );
    await ensureProductsSearchIndex();

    // The index reports "queryable" before mongot has necessarily caught up
    // with the just-inserted docs — poll the real pipeline until all three
    // fixtures are visible.
    const appModule = await import("../../../src/app.js");
    app = (appModule as unknown as { default: Express }).default;
    await pollUntil(
      async () => {
        const res = await request(app).get("/api/products").query({ limit: 50 });
        return res.status === 200 && (res.body.data as unknown[]).length >= products.length;
      },
      { timeoutMs: 120_000, intervalMs: 3_000 },
    );
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    if (mongoose?.connection?.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  const names = (res: { body: { data: Array<{ name: string }> } }) =>
    res.body.data.map((item) => item.name).sort();

  it(
    "filters by variant attribute (embeddedDocument on variants.attributes)",
    async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ attributeName: "Color", attributeValue: "Red" });
      expect(res.status).toBe(200);
      expect(names(res)).toEqual(["Alpha Phone", "Gamma Tablet"]);
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "filters by a filterable-specification value (embeddedDocument on specifications.values)",
    async () => {
      const res = await request(app).get("/api/products").query({ "spec[RAM]": "8GB" });
      expect(res.status).toBe(200);
      expect(names(res)).toEqual(["Alpha Phone", "Gamma Tablet"]);
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "filters by a specification numeric range",
    async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ "spec[Weight][min]": "140", "spec[Weight][max]": "190" });
      expect(res.status).toBe(200);
      expect(names(res)).toEqual(["Alpha Phone", "Gamma Tablet"]);
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "combines a keyword with a variant-attribute filter",
    async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ q: "phone", attributeName: "Color", attributeValue: "Red" });
      expect(res.status).toBe(200);
      expect(names(res)).toEqual(["Alpha Phone"]);
    },
    CASE_TIMEOUT_MS,
  );
});

async function pollUntil(
  check: () => Promise<boolean>,
  { timeoutMs, intervalMs }: { timeoutMs: number; intervalMs: number },
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`pollUntil: condition not met within ${timeoutMs / 1000}s`);
}
