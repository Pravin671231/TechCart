import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { requireActorId } from "@/utils/actor";
import { initiatePayment, verifyPayment } from "./payments.service";

// FR-PAY-005 — every field required; the widget's success callback always
// supplies all three.
const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function initiatePaymentHandler(req: Request, res: Response): Promise<void> {
  const orderId = parseObjectId(req.params.id);
  const result = await initiatePayment(requireActorId(req), orderId.toString());
  res.status(201).json(successResponse(result));
}

export async function verifyPaymentHandler(req: Request, res: Response): Promise<void> {
  const orderId = parseObjectId(req.params.id);
  const input = verifyPaymentSchema.parse(req.body);
  const order = await verifyPayment(requireActorId(req), orderId.toString(), input);
  res.status(200).json(successResponse(order));
}
