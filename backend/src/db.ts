import dotenv from "dotenv";
import { Pool, PoolClient } from "pg";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Please define it in your backend .env file.");
}

// ── Neon-compatible pool settings ────────────────────────────────────────────
// Neon's serverless pooler (PgBouncer) closes idle connections aggressively.
// Keep the pool small, idle-timeout short (so WE release before Neon drops),
// and connection-timeout generous enough to handle cold-start wake-up (~3 s).
const MAX_CONNECTIONS = parseInt(process.env.DB_POOL_MAX ?? "5", 10);

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },

  max: MAX_CONNECTIONS,

  // Release idle connections before Neon's pooler cuts them (~5 s threshold)
  idleTimeoutMillis: 10_000,

  // Allow up to 15 s for Neon to wake from autosuspend on a cold start
  connectionTimeoutMillis: 15_000,

  // Keep TCP connections alive so the OS/network doesn't silently drop them
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

// Apply per-connection settings after the connection is established
pool.on("connect", (client: PoolClient) => {
  // Hard limit on any individual statement
  client.query("SET statement_timeout = '30s'").catch((err) => {
    console.error("[pool] Failed to set statement_timeout:", err);
  });
});

pool.on("error", (err) => {
  // Log but do NOT crash — the pool will create a new connection on next use
  console.error("[pool] Idle client error (connection will be replaced):", err.message);
});

// ── Retry helper ──────────────────────────────────────────────────────────────
// Neon occasionally terminates connections mid-flight (autosuspend, failover).
// This wraps any pool query with one automatic retry on transient errors.
const TRANSIENT_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "EPIPE", "57P01", "08006", "08001"]);

export async function withRetry<T>(
  fn: (client: PoolClient) => Promise<T>,
  retries = 1,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const client = await pool.connect();
    try {
      const result = await fn(client);
      return result;
    } catch (err: any) {
      lastErr = err;
      const code: string = err?.code ?? "";
      const msg: string = err?.message ?? "";
      const isTransient =
        TRANSIENT_CODES.has(code) ||
        msg.includes("Connection terminated") ||
        msg.includes("connection timeout") ||
        msg.includes("unexpected");

      if (isTransient && attempt < retries) {
        console.warn(`[pool] Transient DB error (attempt ${attempt + 1}), retrying…`, msg);
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  throw lastErr;
}
