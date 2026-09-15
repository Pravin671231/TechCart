import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { requireActorId } from "@/utils/actor";
import {
  getProfile,
  updateProfile,
  changePassword,
  getAccountDashboard,
  type UpdateProfileInput,
} from "./account.service";

const updateProfileSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
  })
  .refine((value) => value.name !== undefined || value.phone !== undefined, {
    message: "At least one of name or phone is required.",
  });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function getProfileHandler(req: Request, res: Response): Promise<void> {
  const profile = await getProfile(requireActorId(req));
  res.status(200).json(successResponse(profile));
}

export async function updateProfileHandler(req: Request, res: Response): Promise<void> {
  const parsed = updateProfileSchema.parse(req.body);
  const input: UpdateProfileInput = {
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}),
  };
  const profile = await updateProfile(requireActorId(req), input);
  res.status(200).json(successResponse(profile));
}

export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  const input = changePasswordSchema.parse(req.body);
  await changePassword(req, requireActorId(req), input.currentPassword, input.newPassword);
  res.status(200).json(successResponse({ changed: true }));
}

export async function getAccountDashboardHandler(req: Request, res: Response): Promise<void> {
  const dashboard = await getAccountDashboard(requireActorId(req));
  res.status(200).json(successResponse(dashboard));
}
