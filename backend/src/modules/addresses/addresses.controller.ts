import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { requireActorId } from "@/utils/actor";
import {
  addAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "./addresses.service";

// FR-ORD-028 — a 6-digit Indian PIN code (no leading 0). Shared shape reused
// by orders/checkout (M5.2) for inline-address validation, since FR-ORD-004
// validates an inline checkout address identically to this endpoint.
export const pincodeSchema = z
  .string()
  .regex(/^[1-9][0-9]{5}$/, "Must be a valid 6-digit PIN code.");

export const addressInputSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(10).max(15),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: pincodeSchema,
});

const addressUpdateSchema = addressInputSchema.partial();

export async function listAddressesHandler(req: Request, res: Response): Promise<void> {
  const addresses = await listAddresses(requireActorId(req));
  res.status(200).json(successResponse(addresses));
}

export async function addAddressHandler(req: Request, res: Response): Promise<void> {
  const input = addressInputSchema.parse(req.body);
  const address = await addAddress(requireActorId(req), input);
  res.status(201).json(successResponse(address));
}

export async function updateAddressHandler(req: Request, res: Response): Promise<void> {
  const addressId = parseObjectId(req.params.id);
  const input = addressUpdateSchema.parse(req.body);
  const address = await updateAddress(requireActorId(req), addressId.toString(), input);
  res.status(200).json(successResponse(address));
}

export async function deleteAddressHandler(req: Request, res: Response): Promise<void> {
  const addressId = parseObjectId(req.params.id);
  await deleteAddress(requireActorId(req), addressId.toString());
  res.status(200).json(successResponse(null));
}

export async function setDefaultAddressHandler(req: Request, res: Response): Promise<void> {
  const addressId = parseObjectId(req.params.id);
  const address = await setDefaultAddress(requireActorId(req), addressId.toString());
  res.status(200).json(successResponse(address));
}
