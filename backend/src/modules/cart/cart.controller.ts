import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { requireActorId } from "@/utils/actor";
import { MAX_QUANTITY_PER_VARIANT } from "./cart.model";
import { addItem, clearCart, getCart, removeItem, updateItem } from "./cart.service";

const objectIdString = z.string().refine(isValidObjectId, { message: "Must be a valid id." });

// FR-CART-005 — quantity is a positive integer 1-10 on add; rejected outright
// (VALIDATION_ERROR) outside that range, never clamped.
const addItemSchema = z.object({
  variantId: objectIdString,
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_VARIANT),
});

// FR-CART-006 — 0 is allowed on update and removes the line.
const updateItemSchema = z.object({
  quantity: z.number().int().min(0).max(MAX_QUANTITY_PER_VARIANT),
});

export async function getCartHandler(req: Request, res: Response): Promise<void> {
  const cart = await getCart(requireActorId(req));
  res.status(200).json(successResponse(cart));
}

export async function addItemHandler(req: Request, res: Response): Promise<void> {
  const input = addItemSchema.parse(req.body);
  const cart = await addItem(requireActorId(req), input.variantId, input.quantity);
  res.status(200).json(successResponse(cart));
}

export async function updateItemHandler(req: Request, res: Response): Promise<void> {
  const variantId = parseObjectId(req.params.variantId);
  const input = updateItemSchema.parse(req.body);
  const cart = await updateItem(requireActorId(req), variantId.toString(), input.quantity);
  res.status(200).json(successResponse(cart));
}

export async function removeItemHandler(req: Request, res: Response): Promise<void> {
  const variantId = parseObjectId(req.params.variantId);
  const cart = await removeItem(requireActorId(req), variantId.toString());
  res.status(200).json(successResponse(cart));
}

export async function clearCartHandler(req: Request, res: Response): Promise<void> {
  const cart = await clearCart(requireActorId(req));
  res.status(200).json(successResponse(cart));
}
