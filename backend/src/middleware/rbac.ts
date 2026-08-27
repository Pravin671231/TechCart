import type { NextFunction, Request, Response } from "express";
import { extractSessionToken, verifySessionToken } from "@/lib/session";
import { AppError } from "@/utils/AppError";
import type { AdminRole } from "@/scripts/seed/createAdminUser";

// Issue #143/M3.5 — replaces the temporary X-Admin-Key guard (adminAuth.ts)
// for every /api/admin/* route. Generalizes requireRole.ts (#142/M3.4, which
// this file replaces) from a single role to an allow-list, since catalog
// routes need "catalog-manager OR super-admin" rather than one exact role.
//
// Issue #260/M3.22 — the guard now resolves the session solely through the
// custom engine (src/lib/session.ts, Issue #257–259). The Better Auth
// fallback #258 left in place for a still-Better-Auth-backed admin session
// is gone: since #259 every admin session is issued by issueSession(), so
// there is nothing left for that branch to catch, and this was the last
// runtime consumer of src/lib/auth.ts.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

// The role set every catalog route (brands, categories, products,
// categorySpecifications, categoryVariants, uploads) shares — co-located
// here so the six route files import one constant instead of repeating the
// literal array.
export const CATALOG_ADMIN_ROLES = ["catalog-manager", "super-admin"] as const;

// Issue #144/M3.6 — widened from AdminRole-only so the identical guard also
// covers the new buyer-only /api/account/profile routes, instead of a
// parallel middleware duplicating this same session+role check.
export type Role = AdminRole | "buyer";

export function rbac(roles: readonly Role[]) {
  return async function rbacMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const token = extractSessionToken(req);
    if (!token) {
      next(new AppError(401, "UNAUTHENTICATED", "Sign in required."));
      return;
    }

    // A malformed/forged token and an expired-or-revoked session both reject
    // as 401 — verifySessionToken deliberately doesn't distinguish them
    // (see src/lib/session.ts).
    const result = await verifySessionToken(token);
    if (!result.ok) {
      next(new AppError(401, "UNAUTHENTICATED", "Sign in required."));
      return;
    }

    if (!roles.includes(result.role as Role)) {
      next(
        new AppError(403, "FORBIDDEN", `This action requires one of: ${roles.join(", ")}.`),
      );
      return;
    }

    req.user = { id: result.userId, role: result.role };
    next();
  };
}
