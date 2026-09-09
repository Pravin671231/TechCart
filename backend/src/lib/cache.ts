// FR-NFR-BE-004 — a general-purpose response-cache utility.
//
// SRS DIVERGENCE: the SRS says "Redis … as a general-purpose response-cache
// utility." Redis was removed from the backend entirely in PR #351 (Upstash
// was unreliable and nothing needed it), so this is an in-process TTL Map
// instead. `docs/srs/features/0.8-backend-nfr.md` FR-NFR-BE-004 is amended
// to record this. The backend runs as a single instance (Render free plan),
// so a per-instance cache has the same effect a shared Redis cache would;
// revisit only if the deployment ever scales horizontally.
//
// KEY-NAMING CONVENTION — so every module that adopts caching uses one shape
// rather than inventing its own:
//
//   <domain>:<entity>:<identifier>[:<variant>]
//
// lowercase, colon-separated. Examples:
//   dashboard:summary:2026-08-01_2026-08-31
//   dashboard:top-products:2026-08-01_2026-08-31
//   catalog:brand-list:public
//   catalog:category-filters:laptops
//
// DEFAULT TTLs (seconds):
//   CACHE_TTL.VOLATILE  =  60  — aggregates that move with every order/write
//   CACHE_TTL.STANDARD  = 300  — semi-static catalog lookups
//
// INVALIDATION: TTL-only. Nothing ever explicitly busts a key — a stale
// value simply expires. If a write path needs immediate freshness, it
// should not cache that read at all rather than adding bespoke bust logic.

export const CACHE_TTL = {
  VOLATILE: 60,
  STANDARD: 300,
} as const;

type CacheEntry = { value: string; expiresAt: number };

const store = new Map<string, CacheEntry>();

function read(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function write(key: string, value: string, ttlSeconds: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// Get-or-set: returns the cached value if present and unexpired, otherwise
// runs `compute()`, caches its JSON-serialised result, and returns it.
// `compute()` failures propagate — a rejected computation is never cached.
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = read(key);
  if (cached !== null) return JSON.parse(cached) as T;

  const value = await compute();
  write(key, JSON.stringify(value), ttlSeconds);
  return value;
}

// Drop a single key (rarely needed given TTL-only invalidation, but useful
// in a test).
export function invalidateCache(key: string): void {
  store.delete(key);
}

// Test-only: clears all cache state between suites, mirroring
// rateLimit.ts's resetAllRateLimiters() precedent.
export function resetCache(): void {
  store.clear();
}
