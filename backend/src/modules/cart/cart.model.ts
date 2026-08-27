import { Schema, model, type Types } from "mongoose";

// FR-CART-005 — a positive integer capped at 10 per variant, rejected outright
// (not clamped) outside 1-10. Single source of truth: reused by
// cart.controller.ts's Zod schemas and cart.service.ts's add-accumulation
// check, so the two can't drift apart.
export const MAX_QUANTITY_PER_VARIANT = 10;

// FR-CART-003 — a line item references a specific product variant
// (products.variants._id), never a bare product. No price/availability is
// stored here: both are always resolved live from the referenced variant at
// read time (FR-CART-010-014), never persisted on the cart document.
export type CartItem = {
  variant: Types.ObjectId;
  quantity: number;
};

export type CartDocument = {
  user: Types.ObjectId;
  items: CartItem[];
};

const cartItemSchema = new Schema<CartItem>(
  {
    variant: { type: Schema.Types.ObjectId, required: true },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_QUANTITY_PER_VARIANT,
    },
  },
  { _id: false },
);

const cartSchema = new Schema<CartDocument>(
  {
    // FR-CART-001 — exactly one persistent cart per authenticated buyer,
    // keyed by their user id. `unique` gives the Baseline NFR's required
    // unique index; no sparse/guest variant is needed since every cart
    // belongs to a real buyer (FR-CART-002).
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

export const Cart = model<CartDocument>("Cart", cartSchema);
