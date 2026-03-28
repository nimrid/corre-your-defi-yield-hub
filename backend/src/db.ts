import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Please define it in your backend .env file.");
}

// ── Tier-aware pool sizing ───────────────────────────────────────────────────
// Render free/starter PostgreSQL allows ~25 connections total.
// Reserve a few for migrations / admin tools, use the rest for the app.
const MAX_CONNECTIONS = parseInt(process.env.DB_POOL_MAX ?? "20", 10);

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },

  // How many client connections to keep alive simultaneously
  max: MAX_CONNECTIONS,

  // Return a connection to the pool after this many ms of being idle
  idleTimeoutMillis: 30_000,

  // Fail fast if no connection is available after this many ms (so callers
  // get a clear 500 instead of hanging forever)
  connectionTimeoutMillis: 5_000,

  // Kill any statement that runs longer than 10 seconds.
  // Prevents runaway queries from blocking the pool.
  // (Set as a PostgreSQL parameter, not a node-postgres option.)
  // We apply it via an "after connect" hook below.
});

// Apply per-connection settings after the connection is established
pool.on("connect", (client) => {
  // 10-second hard limit on any individual statement
  client.query("SET statement_timeout = '10s'").catch((err) => {
    console.error("[pool] Failed to set statement_timeout:", err);
  });
});

pool.on("error", (err) => {
  console.error("[pool] Unexpected error on idle client:", err);
});
