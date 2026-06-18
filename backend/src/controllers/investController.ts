import type { Request, Response } from "express";
import { pool } from "../db.js";
import { recordReferralAction, REFERRAL_POINTS } from "../lib/referral.js";

/**
 * POST /investments/private-market
 * Records a new private market purchase and triggers referral logic.
 */
export async function createPrivateMarketPurchase(req: Request, res: Response) {
  const { privyUserId, investmentId, amount, receiptImageUrl } = req.body;

  if (!privyUserId || !investmentId || !amount || !receiptImageUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Lookup internal user id
    const userRes = await pool.query("SELECT id FROM users WHERE privy_user_id = $1", [privyUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userRes.rows[0].id;

    // Insert purchase record
    const insertRes = await pool.query(
      `INSERT INTO private_market_purchases (user_id, investment_id, amount, receipt_image_url, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING id`,
      [userId, investmentId, amount, receiptImageUrl]
    );

    // Track referral action for buying private market
    await recordReferralAction(userId, "BUY_PRIVATE_MARKET", REFERRAL_POINTS.BUY_PRIVATE_MARKET);

    return res.status(201).json({ success: true, purchaseId: insertRes.rows[0].id });
  } catch (error) {
    console.error("Error creating private market purchase:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /investments/private-market/:investmentId/stats
 * Fetches the total amount invested for a given investment ID.
 */
export async function getPrivateMarketStats(req: Request, res: Response) {
  const { investmentId } = req.params;

  if (!investmentId) {
    return res.status(400).json({ error: "Missing investment ID" });
  }

  try {
    const statsRes = await pool.query(
      "SELECT SUM(amount) as total FROM private_market_purchases WHERE investment_id = $1",
      [investmentId]
    );

    const totalInvested = Number(statsRes.rows[0]?.total || 0);
    return res.json({ totalInvested });
  } catch (error) {
    console.error(`Error fetching stats for investment ${investmentId}:`, error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
