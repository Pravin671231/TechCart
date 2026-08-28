import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { requireActorId } from "@/utils/actor";
import { addressInputSchema } from "@/modules/addresses/addresses.controller";
import { checkout } from "./orders.service";

const objectIdString = z.string().refine(isValidObjectId, { message: "Must be a valid id." });

// FR-ORD-004 — addressId and an inline shippingAddress are mutually
// exclusive; neither is required (FR-ORD-033 falls back to the default).
const checkoutSchema = z
  .object({
    addressId: objectIdString.optional(),
    shippingAddress: addressInputSchema.optional(),
  })
  .refine((data) => !(data.addressId && data.shippingAddress), {
    message: "Provide either addressId or shippingAddress, not both.",
  });

export async function checkoutHandler(req: Request, res: Response): Promise<void> {
  const input = checkoutSchema.parse(req.body);
  const order = await checkout(requireActorId(req), input);
  res.status(201).json(successResponse(order));
}
