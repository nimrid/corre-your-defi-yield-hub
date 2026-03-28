import type { Request, Response } from "express";
import { pool } from "../db.js";

/**
 * GET /paj-session/:privyUserId
 */
export async function getPajSession(req: Request, res: Response) {
  const { privyUserId } = req.params;

  try {
    const result = await pool.query(
      `SELECT privy_user_id AS "privyUserId",
              email,
              session_token AS "sessionToken",
              expires_at    AS "expiresAt",
              is_active     AS "isActive",
              otp,
              otp_pending   AS "otpPending",
              updated_at    AS "updatedAt"
         FROM paj_user_sessions
        WHERE privy_user_id = $1`,
      [privyUserId]
    );

    if (!result.rows.length) return res.json(null);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching paj session", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /paj-session/:privyUserId
 * Body validated by UpsertPajSessionSchema before reaching here.
 */
export async function upsertPajSession(req: Request, res: Response) {
  const { privyUserId } = req.params;
  const { email, sessionToken, expiresAt, isActive, otp, otpPending, clearOtp } =
    req.body as {
      email?: string | null;
      sessionToken?: string | null;
      expiresAt?: string | null;
      isActive?: boolean | null;
      otp?: string | null;
      otpPending?: boolean | null;
      clearOtp?: boolean;
    };

  try {
    const result = await pool.query(
      `INSERT INTO paj_user_sessions (
          privy_user_id, email, session_token, expires_at, is_active,
          otp, otp_pending, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, FALSE), NOW(), NOW())
        ON CONFLICT (privy_user_id) DO UPDATE SET
          email         = COALESCE(EXCLUDED.email,          paj_user_sessions.email),
          session_token = COALESCE(EXCLUDED.session_token,  paj_user_sessions.session_token),
          expires_at    = COALESCE(EXCLUDED.expires_at,     paj_user_sessions.expires_at),
          is_active     = COALESCE(EXCLUDED.is_active,      paj_user_sessions.is_active),
          otp           = CASE WHEN $8::boolean THEN NULL
                               ELSE COALESCE(EXCLUDED.otp,  paj_user_sessions.otp) END,
          otp_pending   = COALESCE($7, paj_user_sessions.otp_pending),
          updated_at    = NOW()
        RETURNING privy_user_id AS "privyUserId",
                  email,
                  session_token AS "sessionToken",
                  expires_at    AS "expiresAt",
                  is_active     AS "isActive",
                  otp,
                  otp_pending   AS "otpPending",
                  updated_at    AS "updatedAt"`,
      [
        privyUserId,
        email ?? null,
        sessionToken ?? null,
        expiresAt ?? null,
        typeof isActive === "boolean" ? isActive : null,
        otp ?? null,
        typeof otpPending === "boolean" ? otpPending : null,
        Boolean(clearOtp),
      ]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error upserting paj session", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
