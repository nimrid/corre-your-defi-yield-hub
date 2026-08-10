import Redis from "ioredis";

/**
 * Redis client for multi-instance shared state (pending transactions, sessions).
 * Falls back to in-memory Map if REDIS_URL is not configured (local dev).
 */

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_TLS_URL;

let redis: Redis | null = null;
let redisAvailable = false;

if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("[Redis] Max connection retries exceeded. Falling back to in-memory store.");
          redisAvailable = false;
          return null;
        }
        return Math.min(times * 50, 2000);
      },
      reconnectOnError: (err) => {
        console.warn("[Redis] Connection error, attempting reconnect:", err.message);
        return true;
      },
    });

    redis.on("connect", () => {
      redisAvailable = true;
      console.log("[Redis] Connected successfully.");
    });

    redis.on("error", (err) => {
      console.error("[Redis] Error:", err.message);
      redisAvailable = false;
    });
  } catch (err) {
    console.error("[Redis] Failed to initialize:", err);
    redis = null;
    redisAvailable = false;
  }
} else {
  console.warn("[Redis] REDIS_URL not configured — using in-memory fallback (single-instance only).");
}

export { redis, redisAvailable };
