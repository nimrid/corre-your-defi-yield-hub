import { pool } from "../db.js";

interface RateLimitConfig {
  maxTransactionsPerHour: number;
  maxTransactionsPerDay: number;
  maxDailySpendUSD: number;
  maxSingleTransactionUSD: number;
}

// Configure limits based on your use case
const DEFAULT_LIMITS: RateLimitConfig = {
  maxTransactionsPerHour: 10,
  maxTransactionsPerDay: 50,
  maxDailySpendUSD: 100000,
  maxSingleTransactionUSD: 10000,
};

export interface GasSponsorshipCheck {
  allowed: boolean;
  sponsorshipAllowed?: boolean;
  reason?: string;
  currentHourlyCount?: number;
  currentDailyCount?: number;
  currentDailySpend?: number;
}

/**
 * Check if a user is allowed to send a gas-sponsored transaction
 * Implements rate limiting and spending caps
 */
export async function checkGasSponsorshipEligibility(
  privyUserId: string,
  amountUSD: number,
  limits: RateLimitConfig = DEFAULT_LIMITS
): Promise<GasSponsorshipCheck> {
  try {
    // Check single transaction limit for gas sponsorship only.
    // If above this amount, we still allow the transaction but disable sponsorship.
    if (amountUSD > limits.maxSingleTransactionUSD) {
      return {
        allowed: true,
        sponsorshipAllowed: false,
        reason: `Transaction amount ($${amountUSD}) exceeds maximum sponsored amount ($${limits.maxSingleTransactionUSD})`,
      };
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get user's recent transaction count and spending
    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at >= $1) as hourly_count,
        COUNT(*) FILTER (WHERE created_at >= $2) as daily_count,
        COALESCE(SUM(amount::numeric) FILTER (WHERE created_at >= $2), 0) as daily_spend
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE u.privy_user_id = $3
         AND t.direction = 'outgoing'
         AND t.source = 'send_wallet'`,
      [oneHourAgo, oneDayAgo, privyUserId]
    );

    const stats = result.rows[0];
    const hourlyCount = parseInt(stats?.hourly_count || "0");
    const dailyCount = parseInt(stats?.daily_count || "0");
    const dailySpend = parseFloat(stats?.daily_spend || "0");

    // Check hourly rate limit
    if (hourlyCount >= limits.maxTransactionsPerHour) {
      return {
        allowed: false,
        sponsorshipAllowed: false,
        reason: `Hourly transaction limit reached (${hourlyCount}/${limits.maxTransactionsPerHour})`,
        currentHourlyCount: hourlyCount,
        currentDailyCount: dailyCount,
        currentDailySpend: dailySpend,
      };
    }

    // Check daily rate limit
    if (dailyCount >= limits.maxTransactionsPerDay) {
      return {
        allowed: false,
        sponsorshipAllowed: false,
        reason: `Daily transaction limit reached (${dailyCount}/${limits.maxTransactionsPerDay})`,
        currentHourlyCount: hourlyCount,
        currentDailyCount: dailyCount,
        currentDailySpend: dailySpend,
      };
    }

    // Check daily spending limit
    if (dailySpend + amountUSD > limits.maxDailySpendUSD) {
      return {
        allowed: false,
        sponsorshipAllowed: false,
        reason: `Daily spending limit would be exceeded ($${(dailySpend + amountUSD).toFixed(2)}/$${limits.maxDailySpendUSD})`,
        currentHourlyCount: hourlyCount,
        currentDailyCount: dailyCount,
        currentDailySpend: dailySpend,
      };
    }

    // All checks passed and transaction is eligible for sponsorship
    return {
      allowed: true,
      sponsorshipAllowed: true,
      currentHourlyCount: hourlyCount,
      currentDailyCount: dailyCount,
      currentDailySpend: dailySpend,
    };
  } catch (err) {
    console.error("Error checking gas sponsorship eligibility:", err);
    // Fail open - allow transaction if we can't check (prevents blocking legitimate users)
    // In production, you might want to fail closed for security
    return {
      allowed: true,
      sponsorshipAllowed: true,
      reason: "Eligibility check unavailable, proceeding with caution",
    };
  }
}

/**
 * Log suspicious activity for monitoring
 */
export async function logSuspiciousActivity(
  privyUserId: string,
  activityType: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO suspicious_activity 
       (privy_user_id, activity_type, details, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [privyUserId, activityType, JSON.stringify(details)]
    );

    console.warn(`[SECURITY] Suspicious activity detected:`, {
      privyUserId,
      activityType,
      details,
    });

    // TODO: Send alert to monitoring system (e.g., Sentry, Datadog, PagerDuty)
  } catch (err) {
    console.error("Error logging suspicious activity:", err);
  }
}

/**
 * Check for suspicious patterns
 */
export async function detectSuspiciousPatterns(
  privyUserId: string
): Promise<{ suspicious: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check for rapid-fire transactions (more than 5 in 5 minutes)
    const rapidFireResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE u.privy_user_id = $1
         AND t.created_at >= $2`,
      [privyUserId, fiveMinutesAgo]
    );

    const rapidFireCount = parseInt(rapidFireResult.rows[0]?.count || "0");
    if (rapidFireCount > 5) {
      reasons.push(`Rapid-fire transactions detected: ${rapidFireCount} in 5 minutes`);
    }

    // Check for repeated failed transactions
    const failedTxResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM privy_transactions
       WHERE wallet_id IN (
         SELECT address FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE u.privy_user_id = $1
       )
       AND status IN ('failed', 'reverted')
       AND created_at >= $2`,
      [privyUserId, oneHourAgo]
    );

    const failedCount = parseInt(failedTxResult.rows[0]?.count || "0");
    if (failedCount > 3) {
      reasons.push(`Multiple failed transactions: ${failedCount} in past hour`);
    }

    // Check for same-amount transactions (possible automation)
    const sameAmountResult = await pool.query(
      `SELECT amount, COUNT(*) as count
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE u.privy_user_id = $1
         AND t.created_at >= $2
       GROUP BY amount
       HAVING COUNT(*) >= 3`,
      [privyUserId, oneHourAgo]
    );

    if (sameAmountResult.rows.length > 0) {
      reasons.push(`Repeated identical amounts detected: ${sameAmountResult.rows[0].amount} (${sameAmountResult.rows[0].count} times)`);
    }

    return {
      suspicious: reasons.length > 0,
      reasons,
    };
  } catch (err) {
    console.error("Error detecting suspicious patterns:", err);
    return { suspicious: false, reasons: [] };
  }
}

/**
 * Circuit breaker - temporarily disable gas sponsorship if abuse detected
 */
export async function checkCircuitBreaker(): Promise<{
  enabled: boolean;
  reason?: string;
}> {
  try {
    // Check if circuit breaker is active
    const result = await pool.query(
      `SELECT enabled, reason, expires_at
       FROM circuit_breaker
       WHERE name = 'gas_sponsorship'
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return { enabled: true };
    }

    const breaker = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(breaker.expires_at);

    // Check if breaker has expired
    if (now > expiresAt) {
      return { enabled: true };
    }

    // Circuit breaker is active
    return {
      enabled: false,
      reason: breaker.reason || "Gas sponsorship temporarily disabled",
    };
  } catch (err) {
    console.error("Error checking circuit breaker:", err);
    // Fail open - allow transactions if we can't check
    return { enabled: true };
  }
}

/**
 * Activate circuit breaker
 */
export async function activateCircuitBreaker(
  reason: string,
  durationMinutes: number = 60
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    await pool.query(
      `INSERT INTO circuit_breaker (name, enabled, reason, expires_at, created_at)
       VALUES ('gas_sponsorship', false, $1, $2, NOW())`,
      [reason, expiresAt]
    );

    console.error(`[SECURITY] Circuit breaker activated: ${reason}`);
    // TODO: Send critical alert to team
  } catch (err) {
    console.error("Error activating circuit breaker:", err);
  }
}
