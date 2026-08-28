import { Schema, model, type Types } from "mongoose";

// FR-ORD-028 — a buyer's saved shipping address. Standalone account data,
// independent of order lifecycle (FR-ORD-032): no reference back to `orders`
// exists anywhere on this model. Checkout (orders module) copies these
// fields onto an order as an immutable snapshot rather than referencing this
// document live (FR-ORD-026).
export type AddressDocument = {
  user: Types.ObjectId;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

const addressSchema = new Schema<AddressDocument>(
  {
    // FR-ORD-030 — always derived from the session, never client-supplied.
    // Indexed (not unique) since a buyer can have many addresses.
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true },
    isDefault: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

// FR-ORD-031 — at most one default address per buyer, enforced at the
// database level (not just application logic) via a partial unique index
// scoped to isDefault:true documents only.
addressSchema.index(
  { user: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

export const Address = model<AddressDocument>("Address", addressSchema);
