import type { Request, Response } from "express";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { requireActorId } from "@/utils/actor";
import { initiatePayment } from "./payments.service";

export async function initiatePaymentHandler(req: Request, res: Response): Promise<void> {
  const orderId = parseObjectId(req.params.id);
  const result = await initiatePayment(requireActorId(req), orderId.toString());
  res.status(201).json(successResponse(result));
}
