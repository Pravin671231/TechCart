import type { Request, Response } from "express";
import { auth } from "@/lib/auth";

// Better Auth's own handler speaks the Fetch API (Web Request/Response), and
// its native JSON shape is `{message?, code?, cause?}` on error / whatever
// the endpoint returns on success — no `success` key. This repo's error
// contract (root CLAUDE.md, every backend error is `{success, code, message}`)
// still applies to /api/auth/*, so this bridge builds a Web Request from the
// raw Express req, calls the real handler, then reshapes JSON bodies to
// match — while passing redirects (OAuth callback flows) and Set-Cookie
// headers through untouched, since those carry the actual session.
//
// Mounted directly in app.ts, ahead of express.json() — Better Auth needs
// the unparsed request body/stream.
export async function betterAuthHandler(req: Request, res: Response): Promise<void> {
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

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

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    res.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() === "set-cookie") continue;
      res.setHeader(key, value);
    }
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
