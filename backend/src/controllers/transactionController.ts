import type { Request, Response } from "express";
import { pool } from "../db.js";
import { resolveUserId } from "../lib/dbHelpers.js";
import { invalidateCache } from "../lib/responseCache.js";
import type { TransactionInput } from "../models/transaction.js";

/**
 * GET /transactions/:privyUserId
 *
 * ⚡ Resolves userId from cache first — removes the JOIN through users table
 *    so the query hits only the indexed transactions.user_id column.
 */
export async function getTransactions(req: Request, res: Response) {
  const { privyUserId } = req.params;

  try {
    const userId = await resolveUserId(privyUserId);
    if (userId === null) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await pool.query(
      `SELECT id,
              chain_type   AS "chainType",
              asset_symbol AS "assetSymbol",
              amount,
              direction,
              tx_signature AS "txSignature",
              from_address AS "fromAddress",
              to_address   AS "toAddress",
              source,
              created_at   AS "createdAt"
         FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Error querying transactions", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /transactions
 * Invalidates the response cache for this user after writing.
 */
export async function createTransaction(req: Request, res: Response) {
  const body = req.body as TransactionInput;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userId = await resolveUserId(body.privyUserId, client);
    if (userId === null) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found for provided privyUserId" });
    }

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
      ]
    );

    await client.query("COMMIT");

    // Purge cached reads so the next GET reflects the new transaction
    invalidateCache(`/transactions/${body.privyUserId}`);

    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error inserting transaction", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

/**
 * GET /savings-activity/:privyUserId
 *
 * ⚡ Same optimization: userId from cache → direct WHERE user_id = $1.
 */
export async function getSavingsActivity(req: Request, res: Response) {
  const { privyUserId } = req.params;

  try {
    const userId = await resolveUserId(privyUserId);
    if (userId === null) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await pool.query(
      `SELECT id,
              vault_type    AS "vaultType",
              direction,
              usdc_amount   AS "amount",
              wallet_address AS "walletAddress",
              tx_signature  AS "txSignature",
              source,
              created_at    AS "createdAt"
         FROM savings_activity
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Error querying savings activity", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /savings-activity
 * Invalidates cache after writing.
 */
export async function createSavingsActivity(req: Request, res: Response) {
  const body = req.body as {
    privyUserId: string;
    vaultType: string;
    direction: string;
    usdcAmount: string;
    walletAddress?: string | null;
    txSignature?: string | null;
    source?: string | null;
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userId = await resolveUserId(body.privyUserId, client);
    if (userId === null) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found for provided privyUserId" });
    }

    await client.query(
      `INSERT INTO savings_activity
       (user_id, vault_type, direction, usdc_amount, wallet_address, tx_signature, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        body.vaultType,
        body.direction,
        body.usdcAmount,
        body.walletAddress ?? null,
        body.txSignature ?? null,
        body.source ?? null,
      ]
    );

    await client.query("COMMIT");

    invalidateCache(`/savings-activity/${body.privyUserId}`);

    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error inserting savings activity", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}
