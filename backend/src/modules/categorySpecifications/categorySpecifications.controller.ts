import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { getSpecifications, defineSpecifications, updateSpecifications } from "./categorySpecifications.service";

const specificationFieldSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["text", "number", "boolean", "enum"]),
    unit: z.string().min(1).optional(),
    options: z.array(z.string().min(1)).optional(),
    required: z.boolean().optional().default(false),
    filterable: z.boolean().optional().default(false),
  })
  .refine((field) => field.type !== "enum" || (field.options && field.options.length > 0), {
    message: '"options" is required when type is "enum".',
    path: ["options"],
  })
  .refine((field) => !(field.type === "text" && field.filterable), {
    message: '"filterable" cannot be true when type is "text".',
    path: ["filterable"],
  });

const specificationGroupSchema = z.object({
  groupName: z.string().min(1),
  specifications: z.array(specificationFieldSchema),
});

const defineSpecificationsSchema = z.object({
  specificationGroups: z.array(specificationGroupSchema),
});

// PATCH only ever targets something that already exists — see
// categorySpecifications.service.ts's SpecPatchOperation for why there's no
// "create" branch.
const patchOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("renameGroup"), groupName: z.string().min(1), newGroupName: z.string().min(1) }),
  z.object({ op: z.literal("deleteGroup"), groupName: z.string().min(1) }),
  z.object({
    op: z.literal("updateField"),
    groupName: z.string().min(1),
    name: z.string().min(1),
    field: specificationFieldSchema,
  }),
  z.object({ op: z.literal("deleteField"), groupName: z.string().min(1), name: z.string().min(1) }),
]);

export async function getSpecificationsHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const view = await getSpecifications(id);
  res.status(200).json(successResponse(view));
}

export async function putSpecificationsHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = defineSpecificationsSchema.parse(req.body);
  const view = await defineSpecifications(id, input.specificationGroups);
  res.status(200).json(successResponse(view));
}

export async function patchSpecificationsHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const operation = patchOperationSchema.parse(req.body);
  const view = await updateSpecifications(id, operation);
  res.status(200).json(successResponse(view));
}
