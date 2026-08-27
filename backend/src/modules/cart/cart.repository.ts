import type { Types } from "mongoose";
import { Cart, type CartDocument, type CartItem } from "./cart.model";

export type CartRecord = CartDocument & { _id: Types.ObjectId };

// FR-CART-016 — plain read, no creation. A buyer who has added nothing yet
// has no cart document at all; the service turns `null` into the empty-cart
// shape (never a 404).
export async function findByUser(userId: Types.ObjectId): Promise<CartRecord | null> {
  return Cart.findOne({ user: userId }).lean();
}

// FR-CART-001 — the cart is created lazily on the first add. An atomic upsert
// avoids the race two concurrent first-adds would otherwise hit against the
// unique index on `user`.
export async function getOrCreateByUser(userId: Types.ObjectId): Promise<CartRecord> {
  return Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { upsert: true, new: true },
  ).lean();
}

// Full-array replace — same reasoning as categorySpecifications'/
// categoryVariants' replaceGroups/replaceAxes: MongoDB positional array
// update operators are brittle for a low-traffic operation, so the service
// mutates a plain in-memory copy of `items` and this persists the whole
// array in one write. Wrapped in $set for the same partial-vs-replacement
// reason brands/categories/products' own updateById already documents.
export async function replaceItems(
  userId: Types.ObjectId,
  items: CartItem[],
): Promise<CartRecord | null> {
  return Cart.findOneAndUpdate({ user: userId }, { $set: { items } }, { new: true }).lean();
}
