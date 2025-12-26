import express from "express";
import cors from "cors";
import { pool } from "./db";
import type { UserInput, WalletInput } from "./models/user";
import type { TransactionInput } from "./models/transaction";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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
