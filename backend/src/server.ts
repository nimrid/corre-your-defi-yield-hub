import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import type { UserInput, WalletInput } from "./models/user";
import type { TransactionInput } from "./models/transaction";
import africaRoutes from "./routes/africaRoutes.js";
import heliusWebhookRoutes from "./routes/heliusWebhook.js";
import privyWebhookRoutes from "./routes/privyWebhook.js";
import pajOfframpWebhookRoutes from "./routes/pajOfframpWebhook.js";
import pajOnrampWebhookRoutes from "./routes/pajOnrampWebhook.js";
import {
  checkGasSponsorshipEligibility,
  detectSuspiciousPatterns,
  logSuspiciousActivity,
  checkCircuitBreaker,
} from "./middleware/gasSponsorship.js";

const app = express();
const port = process.env.PORT || 4000;

const ALLOWED_ORIGINS = [
  // Local development
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:5173",
  "http://localhost:8080",
  // ngrok tunnel (update substring if your subdomain changes, or widen the regex)
  "https://incongrously-beetlike-anabel.ngrok-free.dev",
  // Production frontend (add your real domain here once deployed)
  "https://defi-corre.onrender.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin header) and all listed origins
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      // Svix webhook verification headers
      "svix-id",
      "svix-timestamp",
      "svix-signature",
      // ngrok browser warning bypass
      "ngrok-skip-browser-warning",
    ],
  })
);

// Handle preflight requests for all routes
app.options("*", cors());


// ⚠️  Mount the Privy webhook route BEFORE express.json().
// The route uses express.raw() internally to capture the raw body for
// Svix signature verification. If express.json() runs first the raw
// Buffer is lost and signature verification will always fail.
app.use("/api/webhooks", privyWebhookRoutes);

// Global JSON body parser — applies to all other routes
app.use(express.json());

// Mount Africa-specific routes
app.use("/fonbnk/africa", africaRoutes);

// Mount Helius webhook routes
app.use("/api/webhooks", heliusWebhookRoutes);

// Mount PAJ off-ramp webhook routes
app.use("/api/webhooks", pajOfframpWebhookRoutes);

// Mount PAJ on-ramp webhook routes
app.use("/api/webhooks", pajOnrampWebhookRoutes);

(async () => {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS pending_withdrawals (
        id SERIAL PRIMARY KEY,
        privy_user_id TEXT NOT NULL,
        owner TEXT NOT NULL,
        withdrawal_id INTEGER NOT NULL,
        mint_address TEXT NOT NULL,
        native_amount TEXT NOT NULL,
        created_timestamp BIGINT NOT NULL,
        cooldown_seconds INTEGER NOT NULL,
        source TEXT,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMPTZ,
        UNIQUE (privy_user_id, withdrawal_id)
      )`,
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS privy_transactions (
        id SERIAL PRIMARY KEY,
        transaction_id TEXT NOT NULL UNIQUE,
        wallet_id TEXT NOT NULL,
        caip2 TEXT NOT NULL,
        user_operation_hash TEXT,
        transaction_hash TEXT,
        replacement_transaction_id TEXT,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ,
        reverted_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        replaced_at TIMESTAMPTZ
      )`,
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS suspicious_activity (
        id SERIAL PRIMARY KEY,
        privy_user_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS circuit_breaker (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        reason TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS paj_user_sessions (
        privy_user_id TEXT PRIMARY KEY,
        email TEXT,
        session_token TEXT,
        expires_at TIMESTAMPTZ,
        is_active BOOLEAN,
        otp TEXT,
        otp_pending BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_suspicious_activity_user 
       ON suspicious_activity(privy_user_id, created_at DESC)`,
    );

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_circuit_breaker_name 
       ON circuit_breaker(name, created_at DESC)`,
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS stock_purchases (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stock_mint TEXT NOT NULL,
        stock_symbol TEXT,
        stock_name TEXT,
        usdc_amount TEXT NOT NULL,
        shares_amount TEXT,
        wallet_address TEXT,
        tx_signature TEXT,
        jupiter_request_id TEXT,
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS savings_activity (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vault_type TEXT NOT NULL, -- 'regular' or 'protected'
        direction TEXT NOT NULL, -- 'deposit' or 'withdrawal'
        usdc_amount TEXT NOT NULL,
        wallet_address TEXT,
        tx_signature TEXT,
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS stock_sales (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stock_mint TEXT NOT NULL,
        stock_symbol TEXT,
        stock_name TEXT,
        usdc_amount TEXT NOT NULL,
        shares_amount TEXT,
        wallet_address TEXT,
        tx_signature TEXT,
        jupiter_request_id TEXT,
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );

    // Referral System Migrations
    await pool.query(
      `ALTER TABLE users 
       ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
       ADD COLUMN IF NOT EXISTS referred_by_id INTEGER REFERENCES users(id)`
    );

    // Create index for referral lookups
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`
    );

    // PAJ off-ramp orders — stores all status updates from the PAJ webhook
    await pool.query(
      `CREATE TABLE IF NOT EXISTS paj_offramp_orders (
        id             TEXT PRIMARY KEY,
        account_number TEXT NOT NULL DEFAULT '',
        bank           TEXT NOT NULL DEFAULT '',
        currency       TEXT NOT NULL DEFAULT 'NGN',
        amount_usdc    NUMERIC NOT NULL DEFAULT 0,
        amount_fiat    NUMERIC,
        rate           NUMERIC,
        fee            NUMERIC,
        status         TEXT NOT NULL DEFAULT 'INIT',
        raw_payload    JSONB,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_paj_offramp_orders_status ON paj_offramp_orders(status, updated_at DESC)`
    );

    // PAJ on-ramp orders — stores all status updates from the PAJ onramp webhook
    await pool.query(
      `CREATE TABLE IF NOT EXISTS paj_onramp_orders (
        id             TEXT PRIMARY KEY,
        account_number TEXT NOT NULL DEFAULT '',
        account_name   TEXT NOT NULL DEFAULT '',
        bank           TEXT NOT NULL DEFAULT '',
        currency       TEXT NOT NULL DEFAULT 'NGN',
        amount_usdc    NUMERIC NOT NULL DEFAULT 0,
        amount_fiat    NUMERIC,
        mint           TEXT NOT NULL DEFAULT '',
        recipient      TEXT NOT NULL DEFAULT '',
        chain          TEXT NOT NULL DEFAULT 'SOLANA',
        rate           NUMERIC,
        status         TEXT NOT NULL DEFAULT 'INIT',
        raw_payload    JSONB,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_paj_onramp_orders_status ON paj_onramp_orders(status, updated_at DESC)`
    );

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_paj_onramp_orders_recipient ON paj_onramp_orders(recipient, updated_at DESC)`
    );
  } catch (err) {
    console.error("Error ensuring tables and columns", err);
  }
})();

/**
 * Generate a unique referral code
 */
async function generateReferralCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed similar looking chars
  let code = "";
  let isUnique = false;

  while (!isUnique) {
    code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const { rows } = await pool.query("SELECT 1 FROM users WHERE referral_code = $1", [code]);
    if (rows.length === 0) {
      isUnique = true;
    }
  }

  return code;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/paj-session/:privyUserId", async (req, res) => {
  const { privyUserId } = req.params;

  if (!privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  try {
    const result = await pool.query(
      `SELECT privy_user_id AS "privyUserId",
              email,
              session_token AS "sessionToken",
              expires_at AS "expiresAt",
              is_active AS "isActive",
              otp,
              otp_pending AS "otpPending",
              updated_at AS "updatedAt"
         FROM paj_user_sessions
        WHERE privy_user_id = $1`,
      [privyUserId],
    );

    if (!result.rows.length) {
      return res.json(null);
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching paj session", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/paj-session/:privyUserId", async (req, res) => {
  const { privyUserId } = req.params;
  const {
    email,
    sessionToken,
    expiresAt,
    isActive,
    otp,
    otpPending,
    clearOtp,
  } = req.body ?? {};

  if (!privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO paj_user_sessions (
          privy_user_id,
          email,
          session_token,
          expires_at,
          is_active,
          otp,
          otp_pending,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          COALESCE($7, FALSE),
          NOW(),
          NOW()
        )
        ON CONFLICT (privy_user_id) DO UPDATE SET
          email = COALESCE(EXCLUDED.email, paj_user_sessions.email),
          session_token = COALESCE(EXCLUDED.session_token, paj_user_sessions.session_token),
          expires_at = COALESCE(EXCLUDED.expires_at, paj_user_sessions.expires_at),
          is_active = COALESCE(EXCLUDED.is_active, paj_user_sessions.is_active),
          otp = CASE WHEN $8::boolean THEN NULL ELSE COALESCE(EXCLUDED.otp, paj_user_sessions.otp) END,
          otp_pending = COALESCE($7, paj_user_sessions.otp_pending),
          updated_at = NOW()
        RETURNING privy_user_id AS "privyUserId",
                  email,
                  session_token AS "sessionToken",
                  expires_at AS "expiresAt",
                  is_active AS "isActive",
                  otp,
                  otp_pending AS "otpPending",
                  updated_at AS "updatedAt"`,
      [
        privyUserId,
        email ?? null,
        sessionToken ?? null,
        expiresAt ?? null,
        typeof isActive === "boolean" ? isActive : null,
        otp ?? null,
        typeof otpPending === "boolean" ? otpPending : null,
        Boolean(clearOtp),
      ],
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error upserting paj session", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Check gas sponsorship eligibility
app.post("/gas-sponsorship/check", async (req, res) => {
  const { privyUserId, amountUSD } = req.body;

  console.log("Gas sponsorship check request:", { privyUserId, amountUSD });

  if (!privyUserId || typeof amountUSD !== "number") {
    console.error("Invalid request:", { privyUserId, amountUSD });
    return res.status(400).json({ error: "privyUserId and amountUSD are required" });
  }

  try {
    // Check circuit breaker first
    const circuitBreaker = await checkCircuitBreaker();
    if (!circuitBreaker.enabled) {
      console.log("Circuit breaker is active:", circuitBreaker.reason);
      return res.json({
        allowed: false,
        reason: circuitBreaker.reason,
      });
    }

    // Check rate limits and spending caps
    const eligibility = await checkGasSponsorshipEligibility(privyUserId, amountUSD);
    console.log("Eligibility result:", eligibility);

    if (!eligibility.allowed) {
      // Log denied attempt
      await logSuspiciousActivity(privyUserId, "rate_limit_exceeded", {
        amountUSD,
        reason: eligibility.reason,
      });
    }

    // Check for suspicious patterns
    const patterns = await detectSuspiciousPatterns(privyUserId);
    if (patterns.suspicious) {
      console.warn("Suspicious patterns detected:", patterns.reasons);
      await logSuspiciousActivity(privyUserId, "suspicious_pattern", {
        reasons: patterns.reasons,
      });

      // Optionally deny if patterns are too suspicious
      // return res.json({
      //   allowed: false,
      //   reason: "Suspicious activity detected",
      // });
    }

    return res.json(eligibility);
  } catch (err) {
    console.error("Error checking gas sponsorship eligibility:", err);
    // Return allowed: true to not block users if check fails
    return res.json({
      allowed: true,
      reason: "Eligibility check unavailable, proceeding with caution",
    });
  }
});

// Get gas sponsorship stats (for monitoring dashboard)
app.get("/gas-sponsorship/stats", async (_req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get transaction stats
    const txStats = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at >= $1) as daily_tx_count,
        COUNT(*) FILTER (WHERE created_at >= $2) as weekly_tx_count,
        COALESCE(SUM(amount::numeric) FILTER (WHERE created_at >= $1), 0) as daily_spend,
        COALESCE(SUM(amount::numeric) FILTER (WHERE created_at >= $2), 0) as weekly_spend
       FROM transactions
       WHERE direction = 'outgoing' AND source = 'send_wallet'`,
      [oneDayAgo, oneWeekAgo]
    );

    // Get suspicious activity count
    const suspiciousStats = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at >= $1) as daily_suspicious,
        COUNT(*) FILTER (WHERE created_at >= $2) as weekly_suspicious
       FROM suspicious_activity`,
      [oneDayAgo, oneWeekAgo]
    );

    // Get circuit breaker status
    const circuitBreaker = await checkCircuitBreaker();

    return res.json({
      transactions: {
        daily: parseInt(txStats.rows[0].daily_tx_count || "0"),
        weekly: parseInt(txStats.rows[0].weekly_tx_count || "0"),
      },
      spending: {
        daily: parseFloat(txStats.rows[0].daily_spend || "0"),
        weekly: parseFloat(txStats.rows[0].weekly_spend || "0"),
      },
      suspicious: {
        daily: parseInt(suspiciousStats.rows[0].daily_suspicious || "0"),
        weekly: parseInt(suspiciousStats.rows[0].weekly_suspicious || "0"),
      },
      circuitBreaker: {
        enabled: circuitBreaker.enabled,
        reason: circuitBreaker.reason,
      },
    });
  } catch (err) {
    console.error("Error fetching gas sponsorship stats:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Simple example route for users
app.get("/users", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 50");
    res.json(result.rows);
  } catch (err) {
    console.error("Error querying users", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch stock buy + sell history for a user
app.get("/stock-history/:privyUserId", async (req, res) => {
  const { privyUserId } = req.params;

  if (!privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  try {
    const client = await pool.connect();

    try {
      const purchases = await client.query(
        `SELECT sp.id,
                sp.stock_mint AS "stockMint",
                sp.stock_symbol AS "stockSymbol",
                sp.stock_name AS "stockName",
                sp.usdc_amount AS "usdcAmount",
                sp.shares_amount AS "sharesAmount",
                sp.wallet_address AS "walletAddress",
                sp.tx_signature AS "txSignature",
                sp.jupiter_request_id AS "jupiterRequestId",
                sp.source,
                sp.created_at AS "createdAt",
                'buy' AS side
           FROM stock_purchases sp
           JOIN users u ON u.id = sp.user_id
          WHERE u.privy_user_id = $1
          ORDER BY sp.created_at DESC
          LIMIT 100`,
        [privyUserId],
      );

      const sales = await client.query(
        `SELECT ss.id,
                ss.stock_mint AS "stockMint",
                ss.stock_symbol AS "stockSymbol",
                ss.stock_name AS "stockName",
                ss.usdc_amount AS "usdcAmount",
                ss.shares_amount AS "sharesAmount",
                ss.wallet_address AS "walletAddress",
                ss.tx_signature AS "txSignature",
                ss.jupiter_request_id AS "jupiterRequestId",
                ss.source,
                ss.created_at AS "createdAt",
                'sell' AS side
           FROM stock_sales ss
           JOIN users u ON u.id = ss.user_id
          WHERE u.privy_user_id = $1
          ORDER BY ss.created_at DESC
          LIMIT 100`,
        [privyUserId],
      );

      const combined = [...purchases.rows, ...sales.rows].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return res.json(combined);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error querying stock history", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
// Fetch aggregated stock holdings (net shares per stock mint) for a user
app.get("/stock-holdings/:privyUserId", async (req, res) => {
  const { privyUserId } = req.params;

  if (!privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  try {
    const result = await pool.query(
      `SELECT stock_mint AS "stockMint",
              COALESCE(SUM(shares_delta), 0) AS "shares"
         FROM (
               SELECT sp.stock_mint,
                      COALESCE(sp.shares_amount::numeric, 0) AS shares_delta
                 FROM stock_purchases sp
                 JOIN users u ON u.id = sp.user_id
                WHERE u.privy_user_id = $1
               UNION ALL
               SELECT ss.stock_mint,
                      -COALESCE(ss.shares_amount::numeric, 0) AS shares_delta
                 FROM stock_sales ss
                 JOIN users u ON u.id = ss.user_id
                WHERE u.privy_user_id = $1
              ) t
        GROUP BY stock_mint
       HAVING COALESCE(SUM(shares_delta), 0) <> 0`,
      [privyUserId],
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Error querying stock holdings", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Record a stock purchase (US stock bought via Jupiter)
app.post("/stock-purchases", async (req, res) => {
  const body = req.body as {
    privyUserId?: string;
    stockMint?: string;
    stockSymbol?: string;
    stockName?: string;
    usdcAmount?: string;
    sharesAmount?: string;
    walletAddress?: string | null;
    txSignature?: string | null;
    jupiterRequestId?: string | null;
    source?: string | null;
  };

  if (!body?.privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  if (!body.stockMint || !body.usdcAmount) {
    return res.status(400).json({ error: "stockMint and usdcAmount are required" });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        "SELECT id FROM users WHERE privy_user_id = $1",
        [body.privyUserId],
      );

      if (!userResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "User not found for provided privyUserId" });
      }

      const userId: number = userResult.rows[0].id;

      await client.query(
        `INSERT INTO stock_purchases
         (user_id, stock_mint, stock_symbol, stock_name, usdc_amount, shares_amount, wallet_address, tx_signature, jupiter_request_id, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          body.stockMint,
          body.stockSymbol ?? null,
          body.stockName ?? null,
          body.usdcAmount,
          body.sharesAmount ?? null,
          body.walletAddress ?? null,
          body.txSignature ?? null,
          body.jupiterRequestId ?? null,
          body.source ?? "invest_buy",
        ],
      );

      await client.query("COMMIT");

      return res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error inserting stock purchase", err);
      return res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DB connection error when inserting stock purchase", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Record a stock sale (US stock sold via Jupiter)
app.post("/stock-sales", async (req, res) => {
  const body = req.body as {
    privyUserId?: string;
    stockMint?: string;
    stockSymbol?: string;
    stockName?: string;
    usdcAmount?: string;
    sharesAmount?: string;
    walletAddress?: string | null;
    txSignature?: string | null;
    jupiterRequestId?: string | null;
    source?: string | null;
  };

  if (!body?.privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  if (!body.stockMint || !body.usdcAmount) {
    return res.status(400).json({ error: "stockMint and usdcAmount are required" });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        "SELECT id FROM users WHERE privy_user_id = $1",
        [body.privyUserId],
      );

      if (!userResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "User not found for provided privyUserId" });
      }

      const userId: number = userResult.rows[0].id;

      await client.query(
        `INSERT INTO stock_sales
         (user_id, stock_mint, stock_symbol, stock_name, usdc_amount, shares_amount, wallet_address, tx_signature, jupiter_request_id, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          body.stockMint,
          body.stockSymbol ?? null,
          body.stockName ?? null,
          body.usdcAmount,
          body.sharesAmount ?? null,
          body.walletAddress ?? null,
          body.txSignature ?? null,
          body.jupiterRequestId ?? null,
          body.source ?? "invest_sell",
        ],
      );

      await client.query("COMMIT");

      return res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error inserting stock sale", err);
      return res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DB connection error when inserting stock sale", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/withdrawals/pending", async (req, res) => {
  const privyUserId = req.query.privyUserId as string | undefined;

  if (!privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  try {
    const result = await pool.query(
      `SELECT privy_user_id, owner, withdrawal_id, mint_address, native_amount, created_timestamp, cooldown_seconds, source, completed, completed_at
         FROM pending_withdrawals
        WHERE privy_user_id = $1 AND completed = FALSE
        ORDER BY created_timestamp DESC`,
      [privyUserId],
    );

    const nowMs = Date.now();

    const mapped = result.rows.map((row) => {
      const createdSec = Number(row.created_timestamp ?? 0);
      const cooldownSec = Number(row.cooldown_seconds ?? 0);
      const readyAtMs = (createdSec + cooldownSec) * 1000;

      return {
        privyUserId: row.privy_user_id as string,
        owner: row.owner as string,
        withdrawalId: row.withdrawal_id as number,
        mintAddress: row.mint_address as string,
        nativeAmount: row.native_amount as string,
        createdTimestamp: createdSec,
        cooldownSeconds: cooldownSec,
        readyAt: new Date(readyAtMs).toISOString(),
        canComplete: nowMs >= readyAtMs,
        source: (row.source ?? undefined) as string | undefined,
      };
    });

    return res.json({ pendingWithdrawals: mapped });
  } catch (err) {
    console.error("Error querying pending withdrawals", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/withdrawals/pending", async (req, res) => {
  const body = req.body as {
    privyUserId?: string;
    owner?: string;
    withdrawalId?: number;
    mintAddress?: string;
    nativeAmount?: string;
    createdTimestamp?: number;
    cooldownSeconds?: number;
    source?: string;
  };

  if (!body.privyUserId || !body.owner || typeof body.withdrawalId !== "number") {
    return res.status(400).json({ error: "privyUserId, owner, and withdrawalId are required" });
  }

  if (!body.mintAddress || !body.nativeAmount || typeof body.createdTimestamp !== "number") {
    return res.status(400).json({ error: "mintAddress, nativeAmount, and createdTimestamp are required" });
  }

  const cooldownSeconds = typeof body.cooldownSeconds === "number" ? body.cooldownSeconds : 0;

  try {
    await pool.query(
      `INSERT INTO pending_withdrawals
       (privy_user_id, owner, withdrawal_id, mint_address, native_amount, created_timestamp, cooldown_seconds, source, completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
       ON CONFLICT (privy_user_id, withdrawal_id)
       DO UPDATE SET mint_address = EXCLUDED.mint_address,
                     native_amount = EXCLUDED.native_amount,
                     created_timestamp = EXCLUDED.created_timestamp,
                     cooldown_seconds = EXCLUDED.cooldown_seconds,
                     source = EXCLUDED.source,
                     completed = FALSE,
                     completed_at = NULL`,
      [
        body.privyUserId,
        body.owner,
        body.withdrawalId,
        body.mintAddress,
        body.nativeAmount,
        body.createdTimestamp,
        cooldownSeconds,
        body.source ?? null,
      ],
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error upserting pending withdrawal", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/withdrawals/complete", async (req, res) => {
  const body = req.body as { privyUserId?: string; withdrawalId?: number };

  if (!body.privyUserId || typeof body.withdrawalId !== "number") {
    return res.status(400).json({ error: "privyUserId and withdrawalId are required" });
  }

  try {
    const result = await pool.query(
      `UPDATE pending_withdrawals
          SET completed = TRUE,
              completed_at = NOW()
        WHERE privy_user_id = $1 AND withdrawal_id = $2 AND completed = FALSE
        RETURNING id`,
      [body.privyUserId, body.withdrawalId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Pending withdrawal not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Error completing pending withdrawal", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch recent transactions for a given Privy user id
app.get("/transactions/:privyUserId", async (req, res) => {
  const { privyUserId } = req.params;

  if (!privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  try {
    const result = await pool.query(
      `SELECT t.id,
              t.chain_type AS "chainType",
              t.asset_symbol AS "assetSymbol",
              t.amount,
              t.direction,
              t.tx_signature AS "txSignature",
              t.from_address AS "fromAddress",
              t.to_address AS "toAddress",
              t.source,
              t.created_at AS "createdAt"
         FROM transactions t
         JOIN users u ON u.id = t.user_id
        WHERE u.privy_user_id = $1
        ORDER BY t.created_at DESC
        LIMIT 100`,
      [privyUserId],
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Error querying transactions", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch savings activity (deposits/withdrawals) for a given Privy user id
app.get("/savings-activity/:privyUserId", async (req, res) => {
  const { privyUserId } = req.params;

  if (!privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  try {
    const result = await pool.query(
      `SELECT sa.id,
              sa.vault_type AS "vaultType",
              sa.direction,
              sa.usdc_amount AS "amount",
              sa.wallet_address AS "walletAddress",
              sa.tx_signature AS "txSignature",
              sa.source,
              sa.created_at AS "createdAt"
         FROM savings_activity sa
         JOIN users u ON u.id = sa.user_id
        WHERE u.privy_user_id = $1
        ORDER BY sa.created_at DESC
        LIMIT 100`,
      [privyUserId],
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Error querying savings activity", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Record a wallet transaction (incoming deposit or outgoing send)
app.post("/transactions", async (req, res) => {
  const body = req.body as TransactionInput;

  if (!body?.privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  if (!body.amount || !body.assetSymbol || !body.direction) {
    return res.status(400).json({ error: "amount, assetSymbol, and direction are required" });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        "SELECT id FROM users WHERE privy_user_id = $1",
        [body.privyUserId],
      );

      if (!userResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "User not found for provided privyUserId" });
      }

      const userId: number = userResult.rows[0].id;

      await client.query(
        `INSERT INTO transactions
         (user_id, chain_type, asset_symbol, amount, direction, tx_signature, from_address, to_address, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          body.chainType,
          body.assetSymbol,
          body.amount,
          body.direction,
          body.txSignature ?? null,
          body.fromAddress,
          body.toAddress,
          body.source ?? null,
        ],
      );

      await client.query("COMMIT");

      return res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error inserting transaction", err);
      return res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DB connection error when inserting transaction", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Upsert a Privy user and their wallets
app.post("/users/upsert", async (req, res) => {
  const body = req.body as UserInput;

  if (!body?.privyUserId) {
    return res.status(400).json({ error: "privyUserId is required" });
  }

  const wallets: WalletInput[] = Array.isArray(body.wallets) ? body.wallets : [];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let referredById: number | null = null;
    if (body.referredByCode) {
      const referrerResult = await client.query(
        "SELECT id FROM users WHERE referral_code = $1",
        [body.referredByCode]
      );
      if (referrerResult.rows.length > 0) {
        referredById = referrerResult.rows[0].id;
      }
    }

    // Check if user exists and has a referral code
    const existingUser = await client.query(
      "SELECT id, referral_code FROM users WHERE privy_user_id = $1",
      [body.privyUserId]
    );

    let referralCode = existingUser.rows[0]?.referral_code;
    if (!referralCode) {
      referralCode = await generateReferralCode();
    }

    const userResult = await client.query(
      `INSERT INTO users (privy_user_id, email, name, referral_code, referred_by_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (privy_user_id)
       DO UPDATE SET 
         email = EXCLUDED.email, 
         name = EXCLUDED.name,
         referral_code = COALESCE(users.referral_code, EXCLUDED.referral_code)
       RETURNING id`,
      [
        body.privyUserId,
        body.email ?? null,
        body.name ?? null,
        referralCode,
        referredById,
      ],
    );

    const userId: number = userResult.rows[0].id;

    // Replace existing wallets for this user
    await client.query("DELETE FROM wallets WHERE user_id = $1", [userId]);

    for (const w of wallets) {
      if (!w.address || !w.chainType) continue;
      await client.query(
        `INSERT INTO wallets (user_id, chain_type, address, is_linked)
         VALUES ($1, $2, $3, $4)`,
        [userId, w.chainType, w.address, w.isLinked ?? true],
      );
    }

    await client.query("COMMIT");

    return res.json({ success: true, userId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error upserting user", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Get referral data for a user
app.get("/users/:privyUserId/referral", async (req, res) => {
  const { privyUserId } = req.params;

  try {
    const userResult = await pool.query(
      "SELECT id, referral_code FROM users WHERE privy_user_id = $1",
      [privyUserId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { id, referral_code } = userResult.rows[0];

    const referralsCountResult = await pool.query(
      "SELECT COUNT(*) FROM users WHERE referred_by_id = $1",
      [id]
    );

    return res.json({
      referralCode: referral_code,
      referralsCount: parseInt(referralsCountResult.rows[0].count),
    });
  } catch (err) {
    console.error("Error fetching referral data:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server listening on port ${port}`);
});
