import type { NextFunction, Request, Response } from "express";
import { auth } from "@/lib/auth";
import { buildFetchHeaders } from "@/utils/fetchHeaders";
import { AppError } from "@/utils/AppError";
import type { AdminRole } from "@/scripts/seed/createAdminUser";

// Issue #142/M3.4 — the first identity-aware admin guard in this codebase;
// every other /api/admin/* route still only checks the shared X-Admin-Key
// secret (adminAuth.ts), which carries no caller identity at all and can't
// support "super-admin only" or "not your own account" checks. Applied
// alongside adminAuth.ts for the new /api/admin/users routes only — the
// broader X-Admin-Key-to-session swap for every other admin route stays a
// separate, deferred follow-up, per #140's own established deferral.
//
// auth.api.getSession({headers}) is this plan's best-known reading of
// better-auth@1.7.1's server-side session-resolution API (one of the most
// commonly documented Better Auth server-side snippets) — written without
// local package access to verify against, same caveat #140's twoFactor
// config and #141's reset-password endpoints both needed; confirm via CI.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminUser?: { id: string; role: string };
    }
  }
}

export function requireRole(role: AdminRole) {
  return async function requireRoleMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const session = await auth.api.getSession({ headers: buildFetchHeaders(req) });
    if (!session?.user) {
      next(new AppError(401, "UNAUTHENTICATED", "Sign in required."));
      return;
    }
    // `role` is a custom additionalFields entry (auth.ts) — its runtime
    // presence on a session's user is already proven by #139/#140's own
    // passing get-session tests (they assert response.body.data.user.role
    // directly), but the TS type auth.api.getSession() infers for this
    // server-side call may not statically include it the same way.
    const user = session.user as typeof session.user & { role?: string };
    if (user.role !== role) {
      next(new AppError(403, "FORBIDDEN", `This action requires the ${role} role.`));
      return;
    }
    req.adminUser = { id: user.id, role: user.role };
    next();
  };
}
