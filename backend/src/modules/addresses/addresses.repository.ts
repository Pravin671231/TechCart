import type { Types } from "mongoose";
import { Address, type AddressDocument } from "./addresses.model";

export type AddressRecord = AddressDocument & { _id: Types.ObjectId };

export type AddressInput = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  state: string;
  pincode: string;
};

// FR-ORD-028 — isDefault always starts false; only setDefault() below ever
// flips it true, keeping the "exactly one default" invariant in one place.
// line2 is conditionally spread rather than always included — under
// exactOptionalPropertyTypes, an explicit `line2: undefined` key (as a plain
// spread of AddressInput would carry) doesn't match Mongoose's doc-shaped
// create() overload and silently falls through to a confusing one.
export async function create(userId: Types.ObjectId, input: AddressInput): Promise<AddressRecord> {
  const doc = await Address.create({
    user: userId,
    fullName: input.fullName,
    phone: input.phone,
    line1: input.line1,
    ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    isDefault: false,
  });
  return doc.toObject();
}

// FR-ORD-029 — newest first.
export async function findByUser(userId: Types.ObjectId): Promise<AddressRecord[]> {
  return Address.find({ user: userId }).sort({ createdAt: -1 }).lean();
}

// FR-ORD-030 — ownership filtered into the query itself ({_id, user}
// together), never fetched by id alone and checked afterward. A non-owned or
// nonexistent id both resolve to `null` here, so the service can return the
// identical not-found error for either case.
export async function findOwned(
  id: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<AddressRecord | null> {
  return Address.findOne({ _id: id, user: userId }).lean();
}

export type AddressUpdateInput = {
  fullName?: string | undefined;
  phone?: string | undefined;
  line1?: string | undefined;
  line2?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
};

export async function updateOwned(
  id: Types.ObjectId,
  userId: Types.ObjectId,
  patch: AddressUpdateInput,
): Promise<AddressRecord | null> {
  return Address.findOneAndUpdate({ _id: id, user: userId }, { $set: patch }, { new: true }).lean();
}

export async function deleteOwned(
  id: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<AddressRecord | null> {
  return Address.findOneAndDelete({ _id: id, user: userId }).lean();
}

export async function findDefaultForUser(userId: Types.ObjectId): Promise<AddressRecord | null> {
  return Address.findOne({ user: userId, isDefault: true }).lean();
}

// FR-ORD-031 — setting a new default clears every other default for this
// buyer first, then sets the target. Two writes rather than one, since the
// partial unique index would otherwise reject a second isDefault:true
// document existing even momentarily within a single-document update.
export async function clearDefaultForUser(userId: Types.ObjectId): Promise<void> {
  await Address.updateMany({ user: userId, isDefault: true }, { $set: { isDefault: false } });
}

export async function setDefaultOwned(
  id: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<AddressRecord | null> {
  return Address.findOneAndUpdate(
    { _id: id, user: userId },
    { $set: { isDefault: true } },
    { new: true },
  ).lean();
}
