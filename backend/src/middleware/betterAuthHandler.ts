import type { Request, Response } from "express";
import { auth } from "@/lib/auth";
import { buildFetchHeaders } from "@/utils/fetchHeaders";

// Headers this bridge always manages itself rather than copying verbatim:
// `set-cookie` is forwarded separately via res.append (a single Headers
// entry can hold multiple Set-Cookie values, which res.setHeader would
// clobber); `content-type`/`content-length` are set by res.json()/res.send()
// themselves and would conflict if copied ahead of them.
const MANAGED_RESPONSE_HEADERS = new Set(["set-cookie", "content-type", "content-length"]);

// Better Auth's own handler speaks the Fetch API (Web Request/Response), and
// its native JSON shape is `{message?, code?, cause?}` on error / whatever
// the endpoint returns on success — no `success` key. This repo's error
// contract (root CLAUDE.md, every backend error is `{success, code, message}`)
// still applies to /api/auth/*, so this bridge builds a Web Request from the
// raw Express req, calls the real handler, then reshapes JSON bodies to
// match — while passing redirects (OAuth callback flows) and Set-Cookie
// headers through untouched, since those carry the actual session.
//
// Every other response header is forwarded too, not just Set-Cookie — the
// `bearer` plugin returns the session token via a `set-auth-token` header on
// sign-in, and the original version of this bridge silently dropped it on
// the JSON-response branch, which is exactly what made the bearer-token fix
// invisible until deployed the first time this feature shipped.
//
// Wired in via src/modules/auth/ (auth.routes.ts/auth.module.ts), the same
// {path, router} module shape every other route uses — mounted first in
// routes/index.ts, ahead of that file's own express.json(), since Better
// Auth needs the unparsed request body/stream.
export async function betterAuthHandler(req: Request, res: Response): Promise<void> {
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const headers = buildFetchHeaders(req);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const request = new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (req as unknown as ReadableStream) : undefined,
    duplex: hasBody ? "half" : undefined,
  } as RequestInit);

  const response = await auth.handler(request);

  for (const cookie of response.headers.getSetCookie()) {
    res.append("Set-Cookie", cookie);
  }
  for (const [key, value] of response.headers.entries()) {
    if (MANAGED_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
    res.setHeader(key, value);
  }

  // Better Auth's own native rate limiter (Issue #145/M3.7's `rateLimit`
  // option below in lib/auth.ts) builds its 429 with a plain
  // `new Response(JSON.stringify({message}), {status:429, headers:{...}})`
  // and no explicit Content-Type — confirmed against the installed
  // better-auth@1.7.1 package's own api/rate-limiter/index.mjs — so the
  // Fetch spec's default USVString-body MIME (`text/plain;charset=UTF-8`)
  // applies instead. Without this exception it would fall into the
  // non-JSON passthrough below and skip the {success,code,message} envelope
  // (and the RATE_LIMITED fallback code just below) entirely.
  const contentType = response.headers.get("content-type") ?? "";
  const isJsonBody = contentType.includes("application/json") || response.status === 429;
  if (!isJsonBody) {
    res.status(response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
    return;
  }

  const body = (await response.json().catch(() => null)) as
    ({ message?: string; code?: string; twoFactorRedirect?: boolean } & Record<string, unknown>) | null;

  if (response.ok) {
    // FR-AUTH-045's OTP_REQUIRED code — Better Auth's own `/sign-in/email`
    // returns `{twoFactorRedirect: true}` (no session) when the password is
    // correct but the account's mandatory 2FA is still pending (confirmed
    // against the installed better-auth@1.7.1 package's own
    // plugins/two-factor/index.mjs), with no `code` of its own to branch on.
    // Nested inside `data`, not top-level, so the envelope's existing
    // "`code` only appears on `success:false`" convention stays intact for
    // every other endpoint — a frontend reads `data.code` for this one.
    const data =
      req.path === "/sign-in/email" && body?.twoFactorRedirect === true
        ? { ...body, code: "OTP_REQUIRED" }
        : body;
    res.status(response.status).json({ success: true, data });
    return;
  }

  // Better Auth's own native rate limiter (see above) has no `code` of its
  // own — RATE_LIMITED here specifically, not the generic AUTH_ERROR
  // fallback, so it's identical to the code my own hooks.before-thrown
  // RATE_LIMITED (src/lib/auth.ts's enforceEmailRateLimits) already uses,
  // regardless of which of the two layers actually tripped.
  const fallbackCode = response.status === 429 ? "RATE_LIMITED" : "AUTH_ERROR";
  res.status(response.status).json({
    success: false,
    code: body?.code ?? fallbackCode,
    message: body?.message ?? "Authentication error",
  });
}
