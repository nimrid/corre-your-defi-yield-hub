import type { Request, Response } from "express";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { resolveUserId } from "../lib/dbHelpers.js";
import { invalidateCache } from "../lib/responseCache.js";
import { recordReferralAction, REFERRAL_POINTS } from "../lib/referral.js";

type StockBody = {
  privyUserId: string;
  stockMint: string;
  stockSymbol?: string | null;
  stockName?: string | null;
  usdcAmount: string;
  sharesAmount?: string | null;
  walletAddress?: string | null;
  txSignature?: string | null;
  jupiterRequestId?: string | null;
  source?: string | null;
};

/**
 * Upsert the stock_holdings_summary row for (userId, stockMint).
 *
 * This keeps a live running total so getStockHoldings becomes a simple
 * key-value lookup instead of a full UNION ALL scan over all trades.
 */
async function updateHoldingsSummary(
  client: PoolClient,
  userId: number,
  stockMint: string,
  sharesDelta: number // positive = buy, negative = sell
): Promise<void> {
  await client.query(
    `INSERT INTO stock_holdings_summary (user_id, stock_mint, shares)
     VALUES ($1, $2, GREATEST($3::numeric, 0::numeric))
     ON CONFLICT (user_id, stock_mint)
     DO UPDATE SET
       shares     = GREATEST(stock_holdings_summary.shares + EXCLUDED.shares, 0::numeric),
       updated_at = NOW()`,
    [userId, stockMint, sharesDelta]
  );
}


/**
 * Backfill stock_holdings_summary for a user who existed before the summary
 * table was introduced.  Runs only when a holdings read finds no rows.
 * After backfill the summary table is correct and future reads are instant.
 */
async function backfillHoldings(userId: number): Promise<void> {
  await pool.query(
    `INSERT INTO stock_holdings_summary (user_id, stock_mint, shares)
     SELECT user_id,
            stock_mint,
            COALESCE(SUM(shares_delta), 0) AS shares
       FROM (
              SELECT user_id, stock_mint,
                     COALESCE(shares_amount::numeric, 0) AS shares_delta
                FROM stock_purchases
               WHERE user_id = $1
              UNION ALL
              SELECT user_id, stock_mint,
                     -COALESCE(shares_amount::numeric, 0) AS shares_delta
                FROM stock_sales
               WHERE user_id = $1
            ) t
      GROUP BY user_id, stock_mint
     HAVING COALESCE(SUM(shares_delta), 0) <> 0
     ON CONFLICT (user_id, stock_mint)
     DO UPDATE SET shares     = EXCLUDED.shares,
                   updated_at = NOW()`,
    [userId]
  );
}

// ── Read endpoints ────────────────────────────────────────────────────────────

/**
 * GET /stocks/history/:privyUserId  (alias: /stock-history/:privyUserId)
 * Fetches combined buy & sell history in a single optimised query.
 */
export async function getStockHistory(req: Request, res: Response) {
  const { privyUserId } = req.params;

  try {
    const userId = await resolveUserId(privyUserId);
    if (userId === null) return res.status(404).json({ error: "User not found" });

    // Single query with UNION ALL — avoids two separate round-trips
    const result = await pool.query(
      `SELECT sub.id,
              sub.stock_mint         AS "stockMint",
              sub.stock_symbol       AS "stockSymbol",
              sub.stock_name         AS "stockName",
              sub.usdc_amount        AS "usdcAmount",
              sub.shares_amount      AS "sharesAmount",
              sub.wallet_address     AS "walletAddress",
              sub.tx_signature       AS "txSignature",
              sub.jupiter_request_id AS "jupiterRequestId",
              sub.source,
              sub.created_at         AS "createdAt",
              sub.side
         FROM (
                SELECT id, stock_mint, stock_symbol, stock_name,
                       usdc_amount, shares_amount, wallet_address,
                       tx_signature, jupiter_request_id, source,
                       created_at, 'buy' AS side
                  FROM stock_purchases
                 WHERE user_id = $1
                UNION ALL
                SELECT id, stock_mint, stock_symbol, stock_name,
                       usdc_amount, shares_amount, wallet_address,
                       tx_signature, jupiter_request_id, source,
                       created_at, 'sell' AS side
                  FROM stock_sales
                 WHERE user_id = $1
              ) sub
         ORDER BY sub.created_at DESC
         LIMIT 200`,
      [userId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Error querying stock history", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /stocks/holdings/:privyUserId  (alias: /stock-holdings/:privyUserId)
 *
 * ⚡ After the first trade this is a simple indexed lookup on
 *    stock_holdings_summary — O(positions) instead of O(all trades).
 */
export async function getStockHoldings(req: Request, res: Response) {
  const { privyUserId } = req.params;

  try {
    const userId = await resolveUserId(privyUserId);
    if (userId === null) return res.status(404).json({ error: "User not found" });

    let result = await pool.query(
      `SELECT stock_mint AS "stockMint",
              GREATEST(shares, 0) AS shares
         FROM stock_holdings_summary
        WHERE user_id = $1 AND shares > 0`,
      [userId]
    );

    // Lazy backfill: user existed before the summary table was introduced
    if (result.rows.length === 0) {
      await backfillHoldings(userId);
      result = await pool.query(
        `SELECT stock_mint AS "stockMint",
                GREATEST(shares, 0) AS shares
           FROM stock_holdings_summary
          WHERE user_id = $1 AND shares > 0`,
        [userId]
      );
    }

    return res.json(result.rows);
  } catch (err) {
    console.error("Error querying stock holdings", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Write endpoints ───────────────────────────────────────────────────────────

/**
 * POST /stocks/purchases  (alias: /stock-purchases)
 */
export async function createStockPurchase(req: Request, res: Response) {
  const body = req.body as StockBody;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userId = await resolveUserId(body.privyUserId, client);
    if (userId === null) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found for provided privyUserId" });
    }

    const sharesDelta = body.sharesAmount ? parseFloat(body.sharesAmount) : 0;

    // Insert trade record + update running holding total in parallel
    await Promise.all([
      client.query(
        `INSERT INTO stock_purchases
         (user_id, stock_mint, stock_symbol, stock_name, usdc_amount, shares_amount,
          wallet_address, tx_signature, jupiter_request_id, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId, body.stockMint, body.stockSymbol ?? null, body.stockName ?? null,
          body.usdcAmount, body.sharesAmount ?? null, body.walletAddress ?? null,
          body.txSignature ?? null, body.jupiterRequestId ?? null,
          body.source ?? "invest_buy",
        ]
      ),
      updateHoldingsSummary(client, userId, body.stockMint, sharesDelta),
    ]);

    await client.query("COMMIT");

    await recordReferralAction(userId, "BUY_US_STOCK", REFERRAL_POINTS.BUY_US_STOCK);

    invalidateCache(`/stocks/history/${body.privyUserId}`);
    invalidateCache(`/stock-history/${body.privyUserId}`);
    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error inserting stock purchase", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

/**
 * POST /stocks/sales  (alias: /stock-sales)
 */
export async function createStockSale(req: Request, res: Response) {
  const body = req.body as StockBody;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userId = await resolveUserId(body.privyUserId, client);
    if (userId === null) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found for provided privyUserId" });
    }

    const sharesDelta = body.sharesAmount ? -parseFloat(body.sharesAmount) : 0;

    await Promise.all([
      client.query(
        `INSERT INTO stock_sales
         (user_id, stock_mint, stock_symbol, stock_name, usdc_amount, shares_amount,
          wallet_address, tx_signature, jupiter_request_id, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId, body.stockMint, body.stockSymbol ?? null, body.stockName ?? null,
          body.usdcAmount, body.sharesAmount ?? null, body.walletAddress ?? null,
          body.txSignature ?? null, body.jupiterRequestId ?? null,
          body.source ?? "invest_sell",
        ]
      ),
      updateHoldingsSummary(client, userId, body.stockMint, sharesDelta),
    ]);

    await client.query("COMMIT");
    invalidateCache(`/stocks/history/${body.privyUserId}`);
    invalidateCache(`/stock-history/${body.privyUserId}`);
    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error inserting stock sale", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}
