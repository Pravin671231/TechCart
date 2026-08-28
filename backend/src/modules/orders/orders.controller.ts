import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { requireActorId } from "@/utils/actor";
import { addressInputSchema } from "@/modules/addresses/addresses.controller";
import { cancelOwnedOrder, checkout, getOwnedOrder, listOrdersForBuyer } from "./orders.service";

const objectIdString = z.string().refine(isValidObjectId, { message: "Must be a valid id." });

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

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

// FR-ORD-011
export async function listOrdersHandler(req: Request, res: Response): Promise<void> {
  const { page, limit } = listOrdersQuerySchema.parse(req.query);
  const { items, pagination } = await listOrdersForBuyer(requireActorId(req), page, limit);
  res.status(200).json(successResponse(items, pagination));
}

// FR-ORD-012, FR-ORD-013
export async function getOrderHandler(req: Request, res: Response): Promise<void> {
  const orderId = parseObjectId(req.params.id);
  const order = await getOwnedOrder(requireActorId(req), orderId.toString());
  res.status(200).json(successResponse(order));
}

// FR-ORD-014
export async function cancelOrderHandler(req: Request, res: Response): Promise<void> {
  const orderId = parseObjectId(req.params.id);
  const order = await cancelOwnedOrder(requireActorId(req), orderId.toString());
  res.status(200).json(successResponse(order));
}
