/**
 * userCache.ts
 *
 * A lightweight in-process TTL cache for the privyUserId → internal userId
 * mapping.  This lookup (`SELECT id FROM users WHERE privy_user_id = $1`)
 * happens on EVERY write in the application (transactions, savings, stock
 * trades…).  Caching it saves at least one DB round-trip on every such
 * request without any external dependency.
 *
 * TTL = 5 minutes.  On upsert the entry is refreshed immediately so all
 * writes after a fresh login see the correct id with zero latency.
 */

interface CacheEntry {
  userId: number;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1_000; // 5 minutes

const cache = new Map<string, CacheEntry>();

/** Store or refresh an entry. Called from upsertUser so the id is always warm. */
export function setUserIdCache(privyUserId: string, userId: number): void {
  cache.set(privyUserId, { userId, expiresAt: Date.now() + TTL_MS });
}

/** Read a cached userId. Returns undefined on miss or expiry. */
export function getUserIdFromCache(privyUserId: string): number | undefined {
  const entry = cache.get(privyUserId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(privyUserId);
    return undefined;
  }
  return entry.userId;
}

// Periodically sweep expired entries so the Map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}, TTL_MS).unref(); // .unref() so this timer doesn't keep the process alive
