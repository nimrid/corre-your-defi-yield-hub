/**
 * db-helpers.ts
 *
 * Shared DB utilities used across controllers.
 */

import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { getUserIdFromCache, setUserIdCache } from "./userCache.js";

/**
 * Look up the internal `users.id` for a given Privy user ID.
 *
 * Checks the in-process TTL cache first; only hits the database on a miss.
 * An optional `PoolClient` can be passed to re-use an existing transaction.
 *
 * Returns `null` when the user does not exist.
 */
export async function resolveUserId(
  privyUserId: string,
  client?: PoolClient
): Promise<number | null> {
  // 1. Cache hit — zero DB latency
  const cached = getUserIdFromCache(privyUserId);
  if (cached !== undefined) return cached;

  // 2. Cache miss — query the DB
  const executor = client ?? pool;
  const { rows } = await executor.query(
    "SELECT id FROM users WHERE privy_user_id = $1",
    [privyUserId]
  );

  if (!rows.length) return null;

  const userId: number = rows[0].id;
  setUserIdCache(privyUserId, userId);
  return userId;
}
