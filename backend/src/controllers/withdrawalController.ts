import type { Request, Response } from "express";
import { pool } from "../db.js";
import { resolveUserId } from "../lib/dbHelpers.js";

/**
 * GET /withdrawals/pending
 */
export async function getPendingWithdrawals(req: Request, res: Response) {
  const { privyUserId } = req.query as { privyUserId: string };

  try {
    const result = await pool.query(
      `SELECT privy_user_id, owner, withdrawal_id, mint_address, native_amount,
              created_timestamp, cooldown_seconds, source, completed, completed_at
         FROM pending_withdrawals
        WHERE privy_user_id = $1 AND completed = FALSE
        ORDER BY created_timestamp DESC`,
      [privyUserId]
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
}

/**
 * POST /withdrawals/pending
 */
export async function createPendingWithdrawal(req: Request, res: Response) {
  const body = req.body as {
    privyUserId: string;
    owner: string;
    withdrawalId: number;
    mintAddress: string;
    nativeAmount: string;
    createdTimestamp: number;
    cooldownSeconds: number;
    source?: string;
  };

  try {
    await pool.query(
      `INSERT INTO pending_withdrawals
       (privy_user_id, owner, withdrawal_id, mint_address, native_amount,
        created_timestamp, cooldown_seconds, source, completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
       ON CONFLICT (privy_user_id, withdrawal_id)
       DO UPDATE SET mint_address      = EXCLUDED.mint_address,
                     native_amount     = EXCLUDED.native_amount,
                     created_timestamp = EXCLUDED.created_timestamp,
                     cooldown_seconds  = EXCLUDED.cooldown_seconds,
                     source            = EXCLUDED.source,
                     completed         = FALSE,
                     completed_at      = NULL`,
      [
        body.privyUserId, body.owner, body.withdrawalId, body.mintAddress,
        body.nativeAmount, body.createdTimestamp, body.cooldownSeconds,
        body.source ?? null,
      ]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error upserting pending withdrawal", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /withdrawals/complete
 */
export async function completePendingWithdrawal(req: Request, res: Response) {
  const { privyUserId, withdrawalId } = req.body as {
    privyUserId: string;
    withdrawalId: number;
  };

  try {
    const result = await pool.query(
      `UPDATE pending_withdrawals
          SET completed    = TRUE,
              completed_at = NOW()
        WHERE privy_user_id = $1 AND withdrawal_id = $2 AND completed = FALSE
        RETURNING id`,
      [privyUserId, withdrawalId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Pending withdrawal not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Error completing pending withdrawal", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
