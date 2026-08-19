// Idempotent counterpart to run.ts (Issue #106) — every write here is
// find-or-create / find-and-update instead of run.ts's deleteMany +
// insertMany, so this is safe to run repeatedly without destroying existing
// document ids. Covers all five catalog models (brands, categories,
// categorySpecifications, categoryVariants, products) — the last two are
// never touched by run.ts at all. Run with `npm run seed:upsert --workspace
// backend`. run.ts itself is untouched — it remains the default full-reset
// path.
import { Types } from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import { slugify } from "@/utils/slug";
import { Brand } from "@/modules/product-catalog/features/brands/brands.model";
import { Category } from "@/modules/product-catalog/features/categories/categories.model";
import { CategorySpecifications } from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.model";
import { CategoryVariants } from "@/modules/product-catalog/features/categoryVariants/categoryVariants.model";
import { Product } from "@/modules/product-catalog/features/products/products.model";
import { BRAND_NAMES, CATEGORY_TREE, type CategoryNode, type ProductTemplate, type VariantKind } from "./data";
import { buildSimpleImage, createProductBuilder, buildVariantAxesForKind } from "./generate";

export async function upsertBrand(name: string): Promise<{ id: Types.ObjectId; created: boolean }> {
  const slug = slugify(name);
  const existing = await Brand.findOne({ slug });
  if (existing) {
    return { id: existing._id, created: false };
  }
  const created = await Brand.create({ name, slug, logo: buildSimpleImage(name), status: true });
  return { id: created._id, created: true };
}

export async function upsertBrands(
  names: string[],
): Promise<{ idByName: Map<string, Types.ObjectId>; created: number; updated: number }> {
  const idByName = new Map<string, Types.ObjectId>();
  let created = 0;
  let updated = 0;
  for (const name of names) {
    const result = await upsertBrand(name);
    idByName.set(name, result.id);
    if (result.created) created += 1;
    else updated += 1;
  }
  return { idByName, created, updated };
}

export async function upsertCategory(
  node: CategoryNode,
  parentId: Types.ObjectId | null,
  sortOrder: number,
): Promise<{ id: Types.ObjectId; created: boolean }> {
  const slug = slugify(node.name);
  const existing = await Category.findOne({ slug });
  if (existing) {
    return { id: existing._id, created: false };
  }
  const created = await Category.create({
    name: node.name,
    slug,
    parentCategory: parentId,
    image: buildSimpleImage(node.name),
    status: true,
    sortOrder,
  });
  return { id: created._id, created: true };
}

type ProductJob = { node: CategoryNode; categoryId: Types.ObjectId };

async function upsertCategoryNodes(
  nodes: CategoryNode[],
  parentId: Types.ObjectId | null,
  jobs: ProductJob[],
  counts: { created: number; updated: number },
): Promise<void> {
  let sortOrder = 0;
  for (const node of nodes) {
    const result = await upsertCategory(node, parentId, sortOrder);
    sortOrder += 1;
    if (result.created) counts.created += 1;
    else counts.updated += 1;

    if (node.kind && node.products && node.products.length > 0) {
      jobs.push({ node, categoryId: result.id });
    }
    if (node.children && node.children.length > 0) {
      await upsertCategoryNodes(node.children, result.id, jobs, counts);
    }
  }
}

export async function upsertCategories(
  tree: CategoryNode[],
): Promise<{ jobs: ProductJob[]; created: number; updated: number }> {
  const jobs: ProductJob[] = [];
  const counts = { created: 0, updated: 0 };
  await upsertCategoryNodes(tree, null, jobs, counts);
  return { jobs, ...counts };
}

// Full-replace upsert, matching the app's own PUT .../specifications
// behavior for this resource (categorySpecifications.model.ts's `category`
// field carries a unique index, so this is always one doc per category).
export async function upsertCategorySpecifications(
  categoryId: Types.ObjectId,
  groups: CategoryNode["specificationGroups"],
): Promise<{ created: boolean }> {
  const existing = await CategorySpecifications.findOne({ category: categoryId });
  await CategorySpecifications.findOneAndUpdate(
    { category: categoryId },
    { $set: { specificationGroups: groups ?? [] } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return { created: !existing };
}

// Same full-replace-upsert shape as upsertCategorySpecifications, against
// categoryVariants' identical one-doc-per-category unique index.
export async function upsertCategoryVariants(
  categoryId: Types.ObjectId,
  axes: ReturnType<typeof buildVariantAxesForKind>,
): Promise<{ created: boolean }> {
  const existing = await CategoryVariants.findOne({ category: categoryId });
  await CategoryVariants.findOneAndUpdate(
    { category: categoryId },
    { $set: { variants: axes } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return { created: !existing };
}

type ProductBuilder = ReturnType<typeof createProductBuilder>;

// Takes an already-created builder rather than constructing one internally
// (Issue #106) — deliberately, not for convenience: createProductBuilder's
// slug/sku dedup Sets must be shared across every template processed in the
// same logical batch, or two templates whose names collide only *after*
// slugify strips punctuation (e.g. "Samsung Galaxy S24" / "Samsung Galaxy
// S24+" — both slugify to "samsung-galaxy-s24") would silently overwrite
// each other instead of getting distinct, suffixed slugs. A caller upserting
// a single product standalone can still pass a fresh createProductBuilder()
// — the Set-based dedup degrades safely to a no-op when there's nothing else
// in the batch to collide with.
export async function upsertProduct(
  buildProduct: ProductBuilder,
  template: ProductTemplate,
  kind: VariantKind,
  categoryId: Types.ObjectId,
  brandId: Types.ObjectId,
  index: number,
): Promise<{ created: boolean }> {
  const fields = await buildProduct(template, kind, categoryId, brandId, index);
  const existing = await Product.findOne({ slug: fields.slug });
  if (existing) {
    await Product.findByIdAndUpdate(existing._id, { $set: fields });
    return { created: false };
  }
  await Product.create(fields);
  return { created: true };
}

export async function upsertProducts(
  jobs: ProductJob[],
  brandIdByName: Map<string, Types.ObjectId>,
): Promise<{ created: number; updated: number }> {
  // One builder shared across the whole batch — see upsertProduct's comment.
  // Iteration order matches run.ts's own product-building loop exactly
  // (same `jobs`/`templates` traversal), so the resulting slug/sku
  // assignments — including any -2 collision suffixes — are stable across
  // repeated upsert runs, not just within one run.
  const buildProduct = createProductBuilder();
  let created = 0;
  let updated = 0;
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
      const result = await upsertProduct(buildProduct, template, kind, job.categoryId, brandId, index);
      if (result.created) created += 1;
      else updated += 1;
      index += 1;
    }
  }
  return { created, updated };
}

export async function runUpsertSeed(): Promise<void> {
  await connectDB();

  console.log("Upserting brands...");
  const brands = await upsertBrands(BRAND_NAMES);

  console.log("Upserting categories...");
  const categories = await upsertCategories(CATEGORY_TREE);

  console.log("Upserting category specifications and variant types...");
  let specCreated = 0;
  let specUpdated = 0;
  let variantCreated = 0;
  let variantUpdated = 0;
  for (const job of categories.jobs) {
    const specResult = await upsertCategorySpecifications(job.categoryId, job.node.specificationGroups);
    if (specResult.created) specCreated += 1;
    else specUpdated += 1;

    if (job.node.kind) {
      const axes = buildVariantAxesForKind(job.node.kind);
      const variantResult = await upsertCategoryVariants(job.categoryId, axes);
      if (variantResult.created) variantCreated += 1;
      else variantUpdated += 1;
    }
  }

  console.log("Upserting products...");
  const products = await upsertProducts(categories.jobs, brands.idByName);

  console.log("Upsert seed complete:");
  console.log(`  Brands:                 created ${brands.created}, updated ${brands.updated}`);
  console.log(`  Categories:             created ${categories.created}, updated ${categories.updated}`);
  console.log(`  Category specs:         created ${specCreated}, updated ${specUpdated}`);
  console.log(`  Category variant types: created ${variantCreated}, updated ${variantUpdated}`);
  console.log(`  Products:               created ${products.created}, updated ${products.updated}`);

  await disconnectDB();
}

if (require.main === module) {
  runUpsertSeed().catch((error: unknown) => {
    console.error("Upsert seed failed:", error);
    process.exit(1);
  });
}
