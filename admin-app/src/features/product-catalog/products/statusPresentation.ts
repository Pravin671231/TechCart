import type { ProductStatus } from "./types";

export const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const STATUS_TONE: Record<ProductStatus, "success" | "neutral"> = {
  published: "success",
  draft: "neutral",
  archived: "neutral",
};
