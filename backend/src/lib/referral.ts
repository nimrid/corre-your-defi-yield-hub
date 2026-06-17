import { pool } from "../db.js";

export const REFERRAL_POINTS = {
  SIGNUP: 1,
  DEPOSIT_SHIELDED: 2,
  DEPOSIT_STANDARD: 3,
  BUY_US_STOCK: 4,
  BUY_PRIVATE_MARKET: 5,
};

/**
 * Records a completed action for a referred user and awards points to the referrer.
 * Uses ON CONFLICT to ensure each action is only rewarded once per referred user.
 */
export async function recordReferralAction(userId: number, actionType: string, points: number) {
  try {
    const { rows } = await pool.query("SELECT referred_by_id FROM users WHERE id = $1", [userId]);
    const referredById = rows[0]?.referred_by_id;
    if (referredById) {
      await pool.query(
        `INSERT INTO referral_actions (referrer_id, referred_id, action_type, points)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (referred_id, action_type) DO NOTHING`,
        [referredById, userId, actionType, points]
      );
    }
  } catch (err) {
    console.error(`Error recording referral action ${actionType} for user ${userId}:`, err);
  }
}
