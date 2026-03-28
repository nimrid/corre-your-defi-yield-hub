/**
 * responseCache.ts
 *
 * A lightweight in-process TTL cache for read-heavy API responses.
 * Designed for endpoints that are called frequently but whose data
 * changes at most every few seconds (transaction history, savings activity,
 * gas sponsorship stats, etc.).
 *
 * TTL is configurable per cache key. Use the middleware factory
 * `cacheResponse()` to wrap any GET route handler.
 *
 * Cache is keyed by the full request URL path, so different users
 * get separate cache entries automatically.
 *
 * Invalidation is explicit: call `invalidateCache(prefix)` inside write
 * handlers to purge stale entries, or just let them expire naturally.
 */

interface CachedResponse {
  statusCode: number;
  body: unknown;
  expiresAt: number;
}

const store = new Map<string, CachedResponse>();

// ── Core primitives ───────────────────────────────────────────────────────────

export function getCached(key: string): CachedResponse | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function setCached(key: string, body: unknown, ttlMs: number, statusCode = 200): void {
  store.set(key, { statusCode, body, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalidate all cache entries whose key starts with `prefix`.
 * Call this from write handlers to proactively purge stale reads.
 * e.g. invalidateCache(`/transactions/${privyUserId}`)
 */
export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

// Sweep expired entries periodically so the Map stays bounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 60_000).unref();

// ── Express middleware factory ────────────────────────────────────────────────

import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that caches successful GET responses for `ttlMs` milliseconds.
 *
 * @param ttlMs   How long to keep the response. Defaults to 30 seconds.
 * @param keyFn   Optional function to derive a custom cache key from the
 *                request. Defaults to `req.originalUrl`.
 *
 * Usage:
 *   router.get("/history/:id", cacheResponse(30_000), getStockHistory);
 */
export function cacheResponse(
  ttlMs = 30_000,
  keyFn?: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    const key = keyFn ? keyFn(req) : req.originalUrl;
    const cached = getCached(key);

    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    // Intercept res.json to capture the response
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCached(key, body, ttlMs, res.statusCode);
      }
      res.setHeader("X-Cache", "MISS");
      return originalJson(body);
    };

    next();
  };
}
