import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import type { UserInput, WalletInput } from "./models/user";
import type { TransactionInput } from "./models/transaction";
import africaRoutes from "./routes/africaRoutes.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Mount Africa-specific routes
app.use("/fonbnk/africa", africaRoutes);

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
  } catch (err) {
    console.error("Error ensuring pending_withdrawals table", err);
  }
})();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
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

// Signed proxy for Fonbnk order limits. Expects query params matching Fonbnk's API.
app.get("/fonbnk/order-limits", async (req, res) => {
  try {
    if (!FONBNK_CLIENT_ID || !FONBNK_CLIENT_SECRET) {
      return res.status(500).json({
        error: "Fonbnk client credentials are not configured on the server",
      });
    }

    const ENDPOINT = "/api/v2/order-limits";
    const search = new URLSearchParams(req.query as Record<string, string>).toString();
    const endpoint = search ? `${ENDPOINT}?${search}` : ENDPOINT;

    const { timestamp, signature } = signFonbnkEndpoint(endpoint);

    const response = await fetch(`${FONBNK_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": FONBNK_CLIENT_ID,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Fonbnk order-limits request failed", response.status, response.statusText, text);
      return res.status(502).json({ error: "Failed to fetch order limits from Fonbnk" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("Error calling Fonbnk order-limits endpoint", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Proxy Fonbnk currencies endpoint so the frontend does not call third-party APIs directly
app.get("/fonbnk/currencies", async (_req, res) => {
  try {
    if (!FONBNK_CLIENT_ID || !FONBNK_CLIENT_SECRET) {
      return res.status(500).json({
        error: "Fonbnk client credentials are not configured on the server",
      });
    }

    if (fonbnkCurrenciesFailureCount >= FONBNK_CURRENCIES_MAX_FAILURES) {
      return res.status(502).json({
        error: "Fonbnk currencies endpoint temporarily disabled due to repeated failures",
      });
    }

    const ENDPOINT = "/api/v2/currencies";
    const { timestamp, signature } = signFonbnkEndpoint(ENDPOINT);

    const response = await fetch(`${FONBNK_BASE_URL}${ENDPOINT}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": FONBNK_CLIENT_ID,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      fonbnkCurrenciesFailureCount += 1;
      console.error(
        "Fonbnk currencies request failed",
        response.status,
        response.statusText,
        text,
      );
      return res.status(502).json({ error: "Failed to fetch currencies from Fonbnk" });
    }

    fonbnkCurrenciesFailureCount = 0;
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    fonbnkCurrenciesFailureCount += 1;
    console.error("Error calling Fonbnk currencies endpoint", err);
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

    const userResult = await client.query(
      `INSERT INTO users (privy_user_id, email, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (privy_user_id)
       DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
       RETURNING id`,
      [body.privyUserId, body.email ?? null, body.name ?? null],
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

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server listening on port ${port}`);
});
