import { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import {
  findByVariantId,
  findByVariantIds,
  type ProductRecord,
} from "@/modules/product-catalog/features/products/products.repository";
import type {
  ProductImage,
  ProductVariant,
} from "@/modules/product-catalog/features/products/products.model";
import { MAX_QUANTITY_PER_VARIANT, type CartItem } from "./cart.model";
import type { CartRecord } from "./cart.repository";
import { findByUser, getOrCreateByUser, replaceItems } from "./cart.repository";

// ---------------------------------------------------------------------------
// Response shape — SRS v0.4 §5. Pricing/availability are always derived live
// from the referenced variant here (FR-CART-010-014), never read from a
// stored snapshot.
// ---------------------------------------------------------------------------

export type CartVariantView = {
  id: string;
  sku: string;
  product: { id: string; name: string; slug: string };
  attributes: { name: string; value: string }[];
  primaryImage: { url: string; alt?: string } | null;
};

export type CartLineView = {
  variant: CartVariantView;
  quantity: number;
  sellingPrice: number;
  lineTotal: number;
  unavailable: boolean;
};

export type CartResponse = {
  id?: string;
  items: CartLineView[];
  itemCount: number;
  subtotal: number;
};

// One resolved line: the parent product + the specific embedded variant, or
// undefined when the variant no longer resolves to any product at all.
type ResolvedVariant = { product: ProductRecord; variant: ProductVariant };

function primaryImageOf(images: ProductImage[]): { url: string; alt?: string } | null {
  // normalizeImages() (FR-CAT-084) guarantees exactly one isPrimary on every
  // stored variant; images[0] is a defensive fallback only.
  const image = images.find((img) => img.isPrimary) ?? images[0];
  if (!image) return null;
  return image.alt !== undefined ? { url: image.url, alt: image.alt } : { url: image.url };
}

function toVariantView(resolved: ResolvedVariant): CartVariantView {
  const { product, variant } = resolved;
  return {
    id: variant._id.toString(),
    sku: variant.sku,
    product: {
      id: product._id.toString(),
      name: product.name,
      slug: product.slug,
    },
    attributes: variant.attributes.map((attr) => ({ name: attr.name, value: attr.value })),
    primaryImage: primaryImageOf(variant.images),
  };
}

// A line whose variant no longer resolves to any product (the parent product
// was hard-deleted — soft-delete only flips status to "archived", so this is
// rare) still has to render *something*; it's always flagged unavailable.
function orphanVariantView(variantId: Types.ObjectId): CartVariantView {
  return {
    id: variantId.toString(),
    sku: "",
    product: { id: "", name: "", slug: "" },
    attributes: [],
    primaryImage: null,
  };
}

function buildLineView(item: CartItem, resolved: ResolvedVariant | undefined): CartLineView {
  const overCap = item.quantity > MAX_QUANTITY_PER_VARIANT;
  const unavailable =
    !resolved || resolved.product.status !== "published" || !resolved.variant.active || overCap;

  const sellingPrice = resolved?.variant.sellingPrice ?? 0;
  const lineTotal = unavailable ? 0 : sellingPrice * item.quantity;

  return {
    variant: resolved ? toVariantView(resolved) : orphanVariantView(item.variant),
    quantity: item.quantity,
    sellingPrice,
    lineTotal,
    unavailable,
  };
}

// FR-CART-010-018 — the single place every cart response is shaped. `cart` is
// null for a buyer who has never added anything (FR-CART-016: empty shape, not
// a 404).
async function buildCartResponse(cart: CartRecord | null): Promise<CartResponse> {
  if (!cart || cart.items.length === 0) {
    const base: CartResponse = { items: [], itemCount: 0, subtotal: 0 };
    if (cart) base.id = cart._id.toString();
    return base;
  }

  const products = await findByVariantIds(cart.items.map((item) => item.variant));

  // Index every variant by its own _id string → { product, variant }.
  const byVariantId = new Map<string, ResolvedVariant>();
  for (const product of products) {
    for (const variant of product.variants) {
      byVariantId.set(variant._id.toString(), { product, variant });
    }
  }

  const items = cart.items.map((item) =>
    buildLineView(item, byVariantId.get(item.variant.toString())),
  );

  return {
    id: cart._id.toString(),
    items,
    // FR-CART-017 — itemCount counts every line, including unavailable ones.
    itemCount: items.reduce((sum, line) => sum + line.quantity, 0),
    // FR-CART-011 — subtotal excludes unavailable lines (their lineTotal is
    // already 0), computed server-side, never accepted from the client.
    subtotal: items.reduce((sum, line) => sum + line.lineTotal, 0),
  };
}

// ---------------------------------------------------------------------------
// Operations — every one returns the full cart (SRS §5: `data` is always a
// single cart object).
// ---------------------------------------------------------------------------

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export async function getCart(userId: string): Promise<CartResponse> {
  return buildCartResponse(await findByUser(toObjectId(userId)));
}

export async function addItem(
  userId: string,
  variantId: string,
  quantity: number,
): Promise<CartResponse> {
  const variantOid = toObjectId(variantId);

  // FR-CART-009 — a variant id that doesn't exist is rejected, never silently
  // ignored.
  const exists = await findByVariantId(variantOid);
  if (!exists) {
    throw new AppError(400, "VARIANT_NOT_FOUND", `Variant ${variantId} does not exist.`);
  }

  const cart = await getOrCreateByUser(toObjectId(userId));
  const items = cart.items.map((item) => ({ ...item }));

  const existing = items.find((item) => item.variant.equals(variantOid));
  if (existing) {
    // FR-CART-004 — combine into the existing line. FR-CART-005 — the
    // resulting quantity is rejected outright if it exceeds the cap, not
    // clamped.
    const next = existing.quantity + quantity;
    if (next > MAX_QUANTITY_PER_VARIANT) {
      throw new AppError(
        400,
        "QUANTITY_OUT_OF_RANGE",
        `Quantity per variant is capped at ${MAX_QUANTITY_PER_VARIANT}.`,
      );
    }
    existing.quantity = next;
  } else {
    items.push({ variant: variantOid, quantity });
  }

  return buildCartResponse(await replaceItems(toObjectId(userId), items));
}

function lineNotFound(variantId: string): AppError {
  return new AppError(404, "CART_ITEM_NOT_FOUND", `No cart line for variant ${variantId}.`);
}

export async function updateItem(
  userId: string,
  variantId: string,
  quantity: number,
): Promise<CartResponse> {
  const variantOid = toObjectId(variantId);
  const cart = await findByUser(toObjectId(userId));
  if (!cart) throw lineNotFound(variantId);

  const items = cart.items.map((item) => ({ ...item }));
  const target = items.find((item) => item.variant.equals(variantOid));
  if (!target) throw lineNotFound(variantId);

  // FR-CART-006 — setting quantity to 0 removes the line, equivalent to an
  // explicit remove. Zod has already bounded quantity to 0-10.
  const nextItems =
    quantity === 0
      ? items.filter((item) => !item.variant.equals(variantOid))
      : items.map((item) => (item.variant.equals(variantOid) ? { ...item, quantity } : item));

  return buildCartResponse(await replaceItems(toObjectId(userId), nextItems));
}

export async function removeItem(userId: string, variantId: string): Promise<CartResponse> {
  const variantOid = toObjectId(variantId);
  const cart = await findByUser(toObjectId(userId));
  if (!cart) throw lineNotFound(variantId);

  const remaining = cart.items.filter((item) => !item.variant.equals(variantOid));
  if (remaining.length === cart.items.length) throw lineNotFound(variantId);

  return buildCartResponse(await replaceItems(toObjectId(userId), remaining));
}

// FR-CART-008 — clear every line in one call. Safe to call for a buyer with
// no cart document at all (nothing to clear → empty shape).
export async function clearCart(userId: string): Promise<CartResponse> {
  const userOid = toObjectId(userId);
  const cart = await findByUser(userOid);
  if (!cart) return buildCartResponse(null);
  return buildCartResponse(await replaceItems(userOid, []));
}
