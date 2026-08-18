// Pure builder functions — no DB access. Turn a data.ts ProductTemplate into
// a full ProductDocument-shaped object (embedded variants included), ready
// for Product.insertMany(). Kept separate from run.ts so the generation
// logic can be reasoned about (and unit-tested) independently of Mongoose
// connection/orchestration concerns.
import { Types } from "mongoose";
import { generateUniqueSlug } from "@/utils/slug";
import { computeSellingPrice } from "@/utils/pricing";
import type {
  ProductDocument,
  ProductImage,
  ProductVariant,
  ProductVariantAttribute,
} from "@/modules/product-catalog/features/products/products.model";
import type { ProductTemplate, VariantKind } from "./data";

const STORAGE_PAIRS: [string, string][] = [
  ["128GB", "256GB"],
  ["256GB", "512GB"],
  ["512GB", "1TB"],
];
const CONFIG_PAIRS: [string, string][] = [
  ["8GB / 256GB", "16GB / 512GB"],
  ["16GB / 512GB", "32GB / 1TB"],
];
const COLOR_PAIRS: [string, string][] = [
  ["Black", "Silver"],
  ["Graphite", "Rose Gold"],
  ["Midnight", "White"],
];
const COLOR_TRIOS: [string, string, string][] = [
  ["Black", "Silver", "Blue"],
  ["Graphite", "Rose Gold", "White"],
  ["Midnight", "Starlight", "Red"],
];

function pick<T>(options: T[], index: number): T {
  // options is always non-empty (module-level constants above), so this
  // index is always in range.
  return options[index % options.length] as T;
}

function buildImage(seedText: string, isPrimary: boolean): ProductImage {
  return {
    url: `https://placehold.co/800x800?text=${encodeURIComponent(seedText)}`,
    isPrimary,
  };
}

function attribute(name: string, value: string): ProductVariantAttribute {
  return { name, value };
}

function buildVariantList(
  kind: VariantKind,
  productName: string,
  productSku: string,
  basePrice: number,
  index: number,
): ProductVariant[] {
  const discount = 5 + (index % 4) * 5; // rotates 5/10/15/20

  let variantOrdinal = 0;
  const makeVariant = (attrs: ProductVariantAttribute[], priceStep: number): ProductVariant => {
    variantOrdinal += 1;
    const mrp = basePrice + priceStep;
    return {
      _id: new Types.ObjectId(),
      sku: `${productSku}-V${variantOrdinal}`,
      attributes: attrs,
      images: [
        buildImage(`${productName} ${attrs.map((a) => a.value).join(" ")}`, variantOrdinal === 1),
      ],
      mrp,
      discount,
      sellingPrice: computeSellingPrice(mrp, discount),
      active: true,
    };
  };

  if (kind === "storage") {
    const [storageA, storageB] = pick(STORAGE_PAIRS, index);
    const [colorA, colorB] = pick(COLOR_PAIRS, index);
    return [
      makeVariant([attribute("Storage", storageA), attribute("Color", colorA)], 0),
      makeVariant([attribute("Storage", storageA), attribute("Color", colorB)], 0),
      makeVariant([attribute("Storage", storageB), attribute("Color", colorA)], 8000),
      makeVariant([attribute("Storage", storageB), attribute("Color", colorB)], 8000),
    ];
  }

  if (kind === "config") {
    const [configA, configB] = pick(CONFIG_PAIRS, index);
    const [colorA, colorB] = pick(COLOR_PAIRS, index);
    return [
      makeVariant([attribute("Configuration", configA), attribute("Color", colorA)], 0),
      makeVariant([attribute("Configuration", configA), attribute("Color", colorB)], 0),
      makeVariant([attribute("Configuration", configB), attribute("Color", colorA)], 20000),
      makeVariant([attribute("Configuration", configB), attribute("Color", colorB)], 20000),
    ];
  }

  // "color" kind — a single axis, three variants
  const colors = pick(COLOR_TRIOS, index);
  return colors.map((color, colorIndex) => makeVariant([attribute("Color", color)], colorIndex * 1500));
}

/**
 * Returns a `buildProduct` closure backed by two in-memory Sets that track
 * every slug/sku minted so far in this run. A Set is enough (no DB
 * round-trip via `generateUniqueSlug`'s injected `slugExists`) because
 * run.ts always clears the Product collection immediately before seeding —
 * there is no pre-existing data to collide with, only within-batch
 * collisions to guard against.
 */
export function createProductBuilder() {
  const usedSlugs = new Set<string>();
  const usedSkus = new Set<string>();

  return async function buildProduct(
    template: ProductTemplate,
    kind: VariantKind,
    categoryId: Types.ObjectId,
    brandId: Types.ObjectId,
    index: number,
  ): Promise<ProductDocument> {
    const slug = await generateUniqueSlug(template.name, (candidate) =>
      Promise.resolve(usedSlugs.has(candidate)),
    );
    usedSlugs.add(slug);

    const skuBase = await generateUniqueSlug(`${template.brand}-${template.name}`, (candidate) =>
      Promise.resolve(usedSkus.has(candidate)),
    );
    usedSkus.add(skuBase);
    const sku = skuBase.toUpperCase();

    const variants = buildVariantList(kind, template.name, sku, template.basePrice, index);
    if (variants.length === 0) {
      throw new Error(`buildVariantList produced no variants for "${template.name}"`);
    }

    return {
      name: template.name,
      slug,
      description: `${template.name} from ${template.brand}. Seeded catalog data for local development and testing.`,
      brand: brandId,
      category: categoryId,
      specifications: [],
      variants,
      isFeatured: index % 7 === 0,
      // Schema default is "draft" — overridden here so seeded products are
      // actually visible through the buyer-facing (published-only) endpoints.
      // Every product built here always has variants (see the throw above),
      // satisfying the FR-CAT-043 publish guard (#102).
      status: "published",
    };
  };
}

export function buildSimpleImage(seedText: string): { url: string } {
  return { url: `https://placehold.co/400x400?text=${encodeURIComponent(seedText)}` };
}
