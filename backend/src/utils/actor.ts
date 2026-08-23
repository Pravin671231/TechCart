import type { Request } from "express";
import { AppError } from "./AppError";

// req.user is attached by rbac (src/middleware/rbac.ts), mounted ahead of
// every handler in every admin route file that calls this — never
// undefined by the time a handler runs. Generalized from
// adminUsers.controller.ts's own local requesterId() on its second use
// (Issue #143), now shared by brands/categories/products' create/update/
// status/variant handlers too.
export function requireActorId(req: Request): string {
  const id = req.user?.id;
  if (!id) {
    throw new AppError(401, "UNAUTHENTICATED", "Sign in required.");
  }
  return id;
}
