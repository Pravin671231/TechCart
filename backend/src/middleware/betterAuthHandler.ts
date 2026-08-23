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

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    res.status(response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
    return;
  }

  const body = (await response.json().catch(() => null)) as
    ({ message?: string; code?: string } & Record<string, unknown>) | null;

  if (response.ok) {
    res.status(response.status).json({ success: true, data: body });
    return;
  }

  res.status(response.status).json({
    success: false,
    code: body?.code ?? "AUTH_ERROR",
    message: body?.message ?? "Authentication error",
  });
}
