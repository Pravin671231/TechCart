import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { requireActorId } from "@/utils/actor";
import { parseQuery } from "@/utils/parseQuery";
import { addressInputSchema } from "@/modules/addresses/addresses.controller";
import { ORDER_SORT_FIELDS, type OrderSortField } from "./orders.repository";
import { ORDER_STATUSES } from "./orders.model";
import {
  advanceOrderStatusForAdmin,
  cancelOrderForAdmin,
  cancelOwnedOrder,
  checkout,
  getOrderForAdmin,
  getOwnedOrder,
  listOrdersForAdmin,
  listOrdersForBuyer,
} from "./orders.service";

const objectIdString = z.string().refine(isValidObjectId, { message: "Must be a valid id." });

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const listAdminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(ORDER_SORT_FIELDS).optional(),
  orderBy: z.enum(["asc", "desc", "none"]).optional().default("none"),
  search: z.string().min(1).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

// FR-ORD-019 — trackingReference is only ever meaningful on the transition
// into `shipped`; the state machine itself is the real enforcement of which
// `status` values are legal from the order's current one.
const advanceStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  trackingReference: z.string().min(1).optional(),
});

// FR-ORD-015 — a required cancellation reason.
const adminCancelSchema = z.object({
  reason: z.string().min(1),
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

// FR-ORD-017
export async function listAdminOrdersHandler(req: Request, res: Response): Promise<void> {
  const query = listAdminOrdersQuerySchema.parse(req.query);
  const { sort } = parseQuery<OrderSortField>(
    undefined,
    { page: query.page, limit: query.limit },
    query.sortBy,
    query.orderBy,
    ORDER_SORT_FIELDS,
  );
  const { items, pagination } = await listOrdersForAdmin({
    page: query.page,
    limit: query.limit,
    ...(sort !== undefined ? { sort } : {}),
    ...(query.search !== undefined ? { search: query.search } : {}),
    ...(query.status !== undefined ? { status: query.status } : {}),
  });
  res.status(200).json(successResponse(items, pagination));
}

// FR-ORD-018
export async function getAdminOrderHandler(req: Request, res: Response): Promise<void> {
  const orderId = parseObjectId(req.params.id);
  const order = await getOrderForAdmin(orderId.toString());
  res.status(200).json(successResponse(order));
}

// FR-ORD-019
export async function advanceOrderStatusHandler(req: Request, res: Response): Promise<void> {
  const orderId = parseObjectId(req.params.id);
  const input = advanceStatusSchema.parse(req.body);
  const order = await advanceOrderStatusForAdmin(
    orderId.toString(),
    input.status,
    input.trackingReference,
  );
  res.status(200).json(successResponse(order));
}

// FR-ORD-015
export async function adminCancelOrderHandler(req: Request, res: Response): Promise<void> {
  const orderId = parseObjectId(req.params.id);
  const input = adminCancelSchema.parse(req.body);
  const order = await cancelOrderForAdmin(orderId.toString(), input.reason);
  res.status(200).json(successResponse(order));
}
