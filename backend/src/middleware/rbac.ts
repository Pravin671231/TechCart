import type { NextFunction, Request, Response } from "express";
import { auth } from "@/lib/auth";
import { extractSessionToken, verifySessionToken } from "@/lib/session";
import { buildFetchHeaders } from "@/utils/fetchHeaders";
import { AppError } from "@/utils/AppError";
import type { AdminRole } from "@/scripts/seed/createAdminUser";

// Issue #143/M3.5 — replaces the temporary X-Admin-Key guard (adminAuth.ts)
// for every /api/admin/* route. Generalizes requireRole.ts (#142/M3.4, which
// this file replaces) from a single role to an allow-list, since catalog
// routes need "catalog-manager OR super-admin" rather than one exact role.
// auth.api.getSession({headers}) is already proven working end-to-end
// against real CI via #142 — no new unverified Better Auth surface here.
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
    // Issue #258/M3.20 — try the new session engine first (what a buyer
    // signed in through Google/OTP now carries); fall back to Better Auth
    // below for a still-Better-Auth-backed admin session. Additive only —
    // the Better Auth branch beneath this is unchanged from before this
    // issue. Only rbac(["buyer"]) (the /api/account/profile guard) actually
    // takes this branch today; no buyer ever holds a token the catalog
    // admin routes' rbac(CATALOG_ADMIN_ROLES) would accept regardless.
    const newEngineToken = extractSessionToken(req);
    if (newEngineToken) {
      const result = await verifySessionToken(newEngineToken);
      if (result.ok) {
        if (!roles.includes(result.role as Role)) {
          next(new AppError(403, "FORBIDDEN", `This action requires one of: ${roles.join(", ")}.`));
          return;
        }
        req.user = { id: result.userId, role: result.role };
        next();
        return;
      }
    }

    const session = await auth.api.getSession({ headers: buildFetchHeaders(req) });
    if (!session?.user) {
      next(new AppError(401, "UNAUTHENTICATED", "Sign in required."));
      return;
    }
    // `role` is a custom additionalFields entry (auth.ts) — its runtime
    // presence on a session's user is already proven by #139/#140's own
    // passing get-session tests, but the TS type auth.api.getSession()
    // infers for this server-side call may not statically include it.
    const user = session.user as typeof session.user & { role?: string };
    if (!roles.includes(user.role as Role)) {
      next(
        new AppError(403, "FORBIDDEN", `This action requires one of: ${roles.join(", ")}.`),
      );
      return;
    }
    req.user = { id: user.id, role: user.role };
    next();
  };
}
