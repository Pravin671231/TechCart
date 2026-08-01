// Standalone, re-runnable seed script for the product catalog. Writes
// directly via Mongoose (bypassing brands/categories/products' service
// layers) since those require real R2-uploaded images via `consumeImageKeys`
// — impractical for bulk seed data. Run with `npm run seed --workspace
// backend`. Clears the Brand/Category/Product collections first, so it's
// safe to re-run at any point during local development.
import { Types } from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import { slugify } from "@/utils/slug";
import { Brand } from "@/modules/product-catalog/features/brands/brands.model";
import { Category } from "@/modules/product-catalog/features/categories/categories.model";
import { Product, type ProductDocument } from "@/modules/product-catalog/features/products/products.model";
import { BRAND_NAMES, CATEGORY_TREE, type CategoryNode } from "./data";
import { buildSimpleImage, createProductBuilder } from "./generate";

type ProductJob = { node: CategoryNode; categoryId: Types.ObjectId };

async function insertCategoryTree(
  nodes: CategoryNode[],
  parentId: Types.ObjectId | null,
  jobs: ProductJob[],
): Promise<void> {
  let sortOrder = 0;
  for (const node of nodes) {
    const category = await Category.create({
      name: node.name,
      slug: slugify(node.name),
      parentCategory: parentId,
      image: buildSimpleImage(node.name),
      status: true,
      sortOrder: sortOrder,
    });
    sortOrder += 1;

    if (node.kind && node.products && node.products.length > 0) {
      jobs.push({ node, categoryId: category._id });
    }
    if (node.children && node.children.length > 0) {
      await insertCategoryTree(node.children, category._id, jobs);
    }
  }
}

export async function runSeed(): Promise<void> {
  await connectDB();

  console.log("Clearing existing catalog data...");
  await Promise.all([Brand.deleteMany({}), Category.deleteMany({}), Product.deleteMany({})]);

  console.log("Inserting brands...");
  const brandDocs = await Brand.insertMany(
    BRAND_NAMES.map((name) => ({
      name,
      slug: slugify(name),
      logo: buildSimpleImage(name),
      status: true,
    })),
  );
  const brandIdByName = new Map(brandDocs.map((brand) => [brand.name, brand._id]));

  console.log("Inserting categories...");
  const jobs: ProductJob[] = [];
  await insertCategoryTree(CATEGORY_TREE, null, jobs);

  console.log("Generating products...");
  const buildProduct = createProductBuilder();
  const products: ProductDocument[] = [];
  let index = 0;
  for (const job of jobs) {
    const kind = job.node.kind;
    const templates = job.node.products;
    if (!kind || !templates) continue;

    for (const template of templates) {
      const brandId = brandIdByName.get(template.brand);
      if (!brandId) {
        throw new Error(`Unknown brand "${template.brand}" referenced by product "${template.name}"`);
      }
      products.push(await buildProduct(template, kind, job.categoryId, brandId, index));
      index += 1;
    }
  }

  console.log("Inserting products...");
  await Product.insertMany(products);

  const totalVariants = products.reduce((sum, product) => sum + product.variants.length, 0);
  const categoryCount = await Category.countDocuments();
  console.log("Seed complete:");
  console.log(`  Brands:     ${brandDocs.length}`);
  console.log(`  Categories: ${categoryCount}`);
  console.log(`  Products:   ${products.length}`);
  console.log(`  Variants:   ${totalVariants}`);

  await disconnectDB();
}

if (require.main === module) {
  runSeed().catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}
