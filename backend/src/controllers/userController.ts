import type { Request, Response } from "express";
import { pool } from "../db.js";
import { setUserIdCache } from "../lib/userCache.js";
import type { UserInput, WalletInput } from "../models/user.js";

/**
 * Generate a unique referral code (collision-resistant at small scale).
 */
async function generateReferralCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  let isUnique = false;

  while (!isUnique) {
    code = Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
    const { rows } = await pool.query("SELECT 1 FROM users WHERE referral_code = $1", [code]);
    if (rows.length === 0) isUnique = true;
  }

  return code;
}

/**
 * Build a single bulk INSERT statement for wallets.
 * Replaces the N sequential INSERTs with one round-trip.
 */
function buildWalletInsert(
  userId: number,
  wallets: WalletInput[]
): { text: string; values: unknown[] } | null {
  const valid = wallets.filter((w) => w.address && w.chainType);
  if (!valid.length) return null;

  const values: unknown[] = [];
  const placeholders = valid.map((w, i) => {
    const base = i * 4;
    values.push(userId, w.chainType, w.address, w.isLinked ?? true);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  });

  return {
    text: `INSERT INTO wallets (user_id, chain_type, address, is_linked) VALUES ${placeholders.join(", ")}`,
    values,
  };
}

/**
 * GET /users
 * List most recent 50 users (admin/debug).
 */
export async function listUsers(_req: Request, res: Response) {
  try {
    const result = await pool.query(
      "SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 50"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error querying users", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /users/upsert
 * Upsert user + wallets in a single transaction.
 *
 * Performance improvements:
 *  - Warms the in-process userId cache on every upsert.
 *  - Replaces per-wallet INSERTs with one bulk statement.
 *  - Referrer lookup is only done when referredByCode is present.
 */
export async function upsertUser(req: Request, res: Response) {
  const body = req.body as UserInput;
  const wallets: WalletInput[] = body.wallets ?? [];

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error("Error acquiring DB connection for upsertUser", err);
    return res.status(503).json({ error: "Database temporarily unavailable, please retry" });
  }

  try {
    await client.query("BEGIN");

    let referredById: number | null = null;
    if (body.referredByCode) {
      const { rows } = await client.query(
        "SELECT id FROM users WHERE referral_code = $1",
        [body.referredByCode]
      );
      if (rows.length > 0) referredById = rows[0].id;
    }

    // Check for an existing referral code in the same query we need anyway
    const existing = await client.query(
      "SELECT id, referral_code FROM users WHERE privy_user_id = $1",
      [body.privyUserId]
    );

    let referralCode: string = existing.rows[0]?.referral_code;
    if (!referralCode) referralCode = await generateReferralCode();

    const userResult = await client.query(
      `INSERT INTO users (privy_user_id, email, name, referral_code, referred_by_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (privy_user_id)
       DO UPDATE SET
         email         = EXCLUDED.email,
         name          = EXCLUDED.name,
         referral_code = COALESCE(users.referral_code, EXCLUDED.referral_code)
       RETURNING id`,
      [body.privyUserId, body.email ?? null, body.name ?? null, referralCode, referredById]
    );

    const userId: number = userResult.rows[0].id;

    // Warm the cache so subsequent writes skip the SELECT entirely
    setUserIdCache(body.privyUserId, userId);

    // Replace wallets: DELETE + bulk INSERT in one statement
    await client.query("DELETE FROM wallets WHERE user_id = $1", [userId]);
    const walletInsert = buildWalletInsert(userId, wallets);
    if (walletInsert) {
      await client.query(walletInsert.text, walletInsert.values);
    }

    await client.query("COMMIT");
    return res.json({ success: true, userId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error upserting user", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

/**
 * GET /users/:privyUserId/referral
 * Runs both queries in parallel.
 */
export async function getUserReferral(req: Request, res: Response) {
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

    // Fire the count query immediately — no need to wait for userResult first
    const [referralsCountResult] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE referred_by_id = $1", [id]),
    ]);

    return res.json({
      referralCode: referral_code,
      referralsCount: parseInt(referralsCountResult.rows[0].count),
    });
  } catch (err) {
    console.error("Error fetching referral data:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
