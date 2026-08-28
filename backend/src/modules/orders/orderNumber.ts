import { Schema, model } from "mongoose";

// FR-ORD-007 — a sequential, unique, human-readable order number, distinct
// from `orders._id`. No counter/sequence pattern exists anywhere else in
// this codebase (every other entity uses ObjectId as its primary key) — this
// is the standard MongoDB atomic-counter idiom: one fixed document,
// incremented via $inc under an upsert so concurrent checkouts never
// collide. The sequence is global and never resets per year; only the
// displayed year prefix changes, avoiding any per-year-reset race.
type CounterDocument = { _id: string; seq: number };

const counterSchema = new Schema<CounterDocument>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

const Counter = model<CounterDocument>("Counter", counterSchema);

const ORDER_NUMBER_COUNTER_ID = "orderNumber";

export async function allocateOrderNumber(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: ORDER_NUMBER_COUNTER_ID },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  const seq = counter!.seq.toString().padStart(6, "0");
  return `TC-${new Date().getFullYear()}-${seq}`;
}
