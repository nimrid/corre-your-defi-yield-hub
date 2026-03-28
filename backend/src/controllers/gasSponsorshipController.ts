import type { Request, Response } from "express";
import { pool } from "../db.js";
import {
  checkGasSponsorshipEligibility,
  detectSuspiciousPatterns,
  logSuspiciousActivity,
  checkCircuitBreaker,
} from "../middleware/gasSponsorship.js";

/**
 * POST /gas-sponsorship/check
 * Body validated by GasSponsorshipCheckSchema before reaching here.
 */
export async function checkGasSponsorship(req: Request, res: Response) {
  const { privyUserId, amountUSD } = req.body as {
    privyUserId: string;
    amountUSD: number;
  };

  try {
    const circuitBreaker = await checkCircuitBreaker();
    if (!circuitBreaker.enabled) {
      return res.json({ allowed: false, reason: circuitBreaker.reason });
    }

    const eligibility = await checkGasSponsorshipEligibility(privyUserId, amountUSD);

    if (!eligibility.allowed) {
      // Fire-and-forget — don't block the response
      logSuspiciousActivity(privyUserId, "rate_limit_exceeded", {
        amountUSD,
        reason: eligibility.reason,
      }).catch((err) => console.error("Error logging suspicious activity:", err));
    }

    detectSuspiciousPatterns(privyUserId)
      .then((patterns) => {
        if (patterns.suspicious) {
          console.warn("Suspicious patterns detected:", patterns.reasons);
          return logSuspiciousActivity(privyUserId, "suspicious_pattern", {
            reasons: patterns.reasons,
          });
        }
      })
      .catch((err) => console.error("Error in suspicion check:", err));

    return res.json(eligibility);
  } catch (err) {
    console.error("Error checking gas sponsorship eligibility:", err);
    return res.json({
      allowed: true,
      reason: "Eligibility check unavailable, proceeding with caution",
    });
  }
}

/**
 * GET /gas-sponsorship/stats
 */
export async function getGasSponsorshipStats(_req: Request, res: Response) {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [txStats, suspiciousStats, circuitBreaker] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= $1) AS daily_tx_count,
           COUNT(*) FILTER (WHERE created_at >= $2) AS weekly_tx_count,
           COALESCE(SUM(amount::numeric) FILTER (WHERE created_at >= $1), 0) AS daily_spend,
           COALESCE(SUM(amount::numeric) FILTER (WHERE created_at >= $2), 0) AS weekly_spend
         FROM transactions
         WHERE direction = 'outgoing' AND source = 'send_wallet'`,
        [oneDayAgo, oneWeekAgo]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= $1) AS daily_suspicious,
           COUNT(*) FILTER (WHERE created_at >= $2) AS weekly_suspicious
         FROM suspicious_activity`,
        [oneDayAgo, oneWeekAgo]
      ),
      checkCircuitBreaker(),
    ]);

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
}
