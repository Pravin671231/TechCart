import { Schema, model, type Types } from "mongoose";

// FR-ORD-008 — the fixed status lifecycle. Declared here (not in a
// stateMachine module yet — that's M5.3/#156) since the schema enum and
// every later issue's status logic both need this single source of truth.
export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// FR-ORD-003 — a frozen snapshot of the product/variant at checkout time,
// never a live reference. Catalog changes after this point (rename,
// reprice, archive) must never alter an existing order.
export type OrderItemSnapshot = {
  product: { id: Types.ObjectId; name: string; slug: string };
  variant: {
    id: Types.ObjectId;
    sku: string;
    attributes: { name: string; value: string }[];
    image: { url: string; alt?: string } | null;
  };
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

// FR-ORD-026 — the shipping address used at checkout, also copied as an
// immutable snapshot. Same field shape as addresses.model.ts's AddressInput,
// deliberately duplicated (not referenced) for the identical reason items
// are snapshotted, not referenced.
export type OrderShippingAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

// FR-ORD-013 — appended on every transition; visible on both buyer and
// admin detail views.
export type OrderStatusHistoryEntry = {
  status: OrderStatus;
  at: Date;
  note?: string;
};

export type OrderDocument = {
  orderNumber: string;
  user: Types.ObjectId;
  items: OrderItemSnapshot[];
  shippingAddress: OrderShippingAddress;
  totalAmount: number;
  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntry[];
  trackingReference?: string;
  cancellationReason?: string;
  // Populated at runtime via this schema's own {timestamps:true} below —
  // declared explicitly (unlike products.model.ts's top-level
  // ProductDocument) since buildOrderResponse() reads order.createdAt
  // directly, same reasoning ProductVariant's own createdAt/updatedAt
  // fields document.
  createdAt: Date;
  updatedAt: Date;
};

const orderItemSchema = new Schema<OrderItemSnapshot>(
  {
    product: {
      id: { type: Schema.Types.ObjectId, required: true },
      name: { type: String, required: true },
      slug: { type: String, required: true },
      _id: false,
    },
    variant: {
      id: { type: Schema.Types.ObjectId, required: true },
      sku: { type: String, required: true },
      attributes: {
        type: [{ name: { type: String, required: true }, value: { type: String, required: true } }],
        required: true,
      },
      image: {
        type: { url: { type: String, required: true }, alt: { type: String } },
        default: null,
      },
      _id: false,
    },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const orderShippingAddressSchema = new Schema<OrderShippingAddress>(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false },
);

const orderStatusHistoryEntrySchema = new Schema<OrderStatusHistoryEntry>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true },
    note: { type: String },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDocument>(
  {
    // FR-ORD-007 — human-readable, sequential, unique, distinct from _id.
    orderNumber: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: orderShippingAddressSchema, required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, index: true },
    statusHistory: { type: [orderStatusHistoryEntrySchema], required: true },
    trackingReference: { type: String },
    cancellationReason: { type: String },
  },
  { timestamps: true },
);

// Baseline NFR (SRS v0.5 §3) — compound index for the buyer history list
// (FR-ORD-011), newest first.
orderSchema.index({ user: 1, createdAt: -1 });

export const Order = model<OrderDocument>("Order", orderSchema);
