import { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import {
  create,
  deleteOwned,
  findByUser,
  findDefaultForUser,
  findOwned,
  clearDefaultForUser,
  setDefaultOwned,
  updateOwned,
  type AddressInput,
  type AddressRecord,
  type AddressUpdateInput,
} from "./addresses.repository";

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

// FR-ORD-030 — a non-owned address id gets the identical error a nonexistent
// one would, so an id can't be used to enumerate other buyers' addresses.
function notFound(): AppError {
  return new AppError(404, "ADDRESS_NOT_FOUND", "Address not found.");
}

export async function listAddresses(userId: string): Promise<AddressRecord[]> {
  return findByUser(toObjectId(userId));
}

export async function addAddress(userId: string, input: AddressInput): Promise<AddressRecord> {
  return create(toObjectId(userId), input);
}

// Exported for orders/checkout (M5.2) to resolve an owned addressId or throw
// the same not-found error a buyer-facing address lookup would.
export async function getOwnedAddress(userId: string, addressId: string): Promise<AddressRecord> {
  const address = await findOwned(toObjectId(addressId), toObjectId(userId));
  if (!address) throw notFound();
  return address;
}

// FR-ORD-033 — checkout's fallback when neither addressId nor an inline
// address is supplied. Returns null (not an error) when the buyer has no
// default; the caller decides what "no default" means for its own flow.
export async function getDefaultAddress(userId: string): Promise<AddressRecord | null> {
  return findDefaultForUser(toObjectId(userId));
}

export async function updateAddress(
  userId: string,
  addressId: string,
  patch: AddressUpdateInput,
): Promise<AddressRecord> {
  const updated = await updateOwned(toObjectId(addressId), toObjectId(userId), patch);
  if (!updated) throw notFound();
  return updated;
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const deleted = await deleteOwned(toObjectId(addressId), toObjectId(userId));
  if (!deleted) throw notFound();
  // FR-ORD-031 — deleting the current default leaves no default; it is
  // never auto-reassigned to another saved address. No further action
  // needed here — the deleted document simply no longer exists.
}

// FR-ORD-031 — setting a new default clears the previous one first. Ownership
// is verified before either write runs, so a non-owned id never clears the
// caller's own default as a side effect of a failed attempt.
export async function setDefaultAddress(userId: string, addressId: string): Promise<AddressRecord> {
  const userOid = toObjectId(userId);
  const addressOid = toObjectId(addressId);

  const owned = await findOwned(addressOid, userOid);
  if (!owned) throw notFound();

  await clearDefaultForUser(userOid);
  const updated = await setDefaultOwned(addressOid, userOid);
  if (!updated) throw notFound();
  return updated;
}
