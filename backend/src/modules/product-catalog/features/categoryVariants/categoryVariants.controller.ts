import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { getVariantAxes, defineVariantAxes, updateVariantAxes } from "./categoryVariants.service";

const variantAxisOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

const variantAxisSchema = z
  .object({
    name: z.string().min(1),
    code: z.string().min(1),
    type: z.enum(["text", "select", "color", "number"]).optional().default("select"),
    required: z.boolean().optional().default(false),
    options: z.array(variantAxisOptionSchema).optional(),
  })
  .refine(
    (axis) =>
      (axis.type !== "select" && axis.type !== "color") ||
      (axis.options && axis.options.length > 0),
    {
      message: '"options" is required when type is "select" or "color".',
      path: ["options"],
    },
  )
  .refine(
    (axis) => (axis.type !== "text" && axis.type !== "number") || axis.options === undefined,
    {
      message: '"options" is not allowed when type is "text" or "number".',
      path: ["options"],
    },
  );

const defineVariantAxesSchema = z.object({
  variants: z.array(variantAxisSchema),
});

// PATCH only ever targets an axis that already exists — see
// categoryVariants.service.ts's VariantAxisPatchOperation for why there's no
// "create" branch.
const patchOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("updateAxis"), code: z.string().min(1), axis: variantAxisSchema }),
  z.object({ op: z.literal("deleteAxis"), code: z.string().min(1) }),
]);

export async function getVariantAxesHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const view = await getVariantAxes(id);
  res.status(200).json(successResponse(view));
}

export async function putVariantAxesHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = defineVariantAxesSchema.parse(req.body);
  const view = await defineVariantAxes(id, input.variants);
  res.status(200).json(successResponse(view));
}

export async function patchVariantAxesHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const operation = patchOperationSchema.parse(req.body);
  const view = await updateVariantAxes(id, operation);
  res.status(200).json(successResponse(view));
}
