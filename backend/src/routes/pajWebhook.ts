import { Router, Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../db.js";

const router = Router();

// Optional shared secret. PAJ Ramp does not sign its webhook bodies, so the only
// authenticity control available is a secret we configure on the callback URL.
// Set PAJ_WEBHOOK_SECRET and register the webhook with PAJ as either:
//   • a custom header  x-paj-webhook-secret: <secret>, OR
//   • a query string   ?secret=<secret>  appended to the webhook URL.
const PAJ_WEBHOOK_SECRET = process.env.PAJ_WEBHOOK_SECRET || "";

const KNOWN_TRANSACTION_TYPES = new Set(["ON_RAMP", "OFF_RAMP"]);

/**
 * Constant-time comparison that tolerates length mismatches.
 */
function secretsMatch(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * Verify the PAJ webhook shared secret.
 *
 *   • secret configured    → require a matching header or query param (fail CLOSED).
 *   • secret NOT configured → warn loudly and allow, preserving the existing live
 *     integration. Set PAJ_WEBHOOK_SECRET to activate enforcement.
 */
function verifyPajSecret(req: Request): boolean {
    if (!PAJ_WEBHOOK_SECRET) {
        console.warn(
            "[PAJ Webhook] PAJ_WEBHOOK_SECRET not set — endpoint is UNAUTHENTICATED. " +
            "Set it and append ?secret=<value> (or an x-paj-webhook-secret header) to the registered PAJ callback URL.",
        );
        return true;
    }
    const provided =
        (req.headers["x-paj-webhook-secret"] as string) ||
        (typeof req.query.secret === "string" ? req.query.secret : "") ||
        "";
    return secretsMatch(provided, PAJ_WEBHOOK_SECRET);
}

/**
 * POST /webhook/paj-ramp
 * 
 * Unified webhook handler for both On-Ramp and Off-Ramp orders.
 * Path follows the official PAJ Ramp SDK example.
 */
router.post("/", async (req: Request, res: Response) => {
    // ── Authenticate ───────────────────────────────────────────────────────
    if (!verifyPajSecret(req)) {
        console.error("[PAJ Webhook] Invalid or missing webhook secret — rejecting.");
        return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body;
    const { id, status, transactionType } = payload ?? {};

    // ── Validate input ─────────────────────────────────────────────────────
    if (typeof id !== "string" || !id.trim() || typeof status !== "string" || !status.trim()) {
        console.warn("[PAJ Webhook] Missing or invalid id/status — ignoring.");
        return res.status(400).json({ error: "Invalid payload: id and status are required strings" });
    }

    // Respond 200 now so PAJ doesn't retry on slow DB writes
    res.status(200).json({ received: true });

    if (!KNOWN_TRANSACTION_TYPES.has(transactionType)) {
        console.warn(`[PAJ Webhook] Unknown transactionType: ${transactionType} — ignoring payload.`);
        return;
    }

    console.log(`[PAJ Webhook] Received ${transactionType} update for order ${id}: ${status}`);
    console.log("[PAJ Webhook] Payload:", JSON.stringify(payload, null, 2));

    try {
        if (transactionType === "ON_RAMP") {
            // Handle On-Ramp update
            await pool.query(
                `INSERT INTO paj_onramp_orders
                 (id, account_number, account_name, bank, currency, amount_usdc, amount_fiat,
                  mint, recipient, chain, rate, status, raw_payload, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
                 ON CONFLICT (id) DO UPDATE
                   SET status         = EXCLUDED.status,
                       amount_fiat    = COALESCE(EXCLUDED.amount_fiat,    paj_onramp_orders.amount_fiat),
                       amount_usdc    = COALESCE(EXCLUDED.amount_usdc,    paj_onramp_orders.amount_usdc),
                       rate           = COALESCE(EXCLUDED.rate,           paj_onramp_orders.rate),
                       raw_payload    = EXCLUDED.raw_payload,
                       updated_at     = NOW()`,
                [
                    id,
                    payload.accountNumber ?? "",
                    payload.accountName ?? "",
                    payload.bank ?? "",
                    payload.currency ?? "NGN",
                    payload.amount ?? 0,
                    payload.fiatAmount ?? null,
                    payload.mint ?? "",
                    payload.recipient ?? "",
                    payload.chain ?? "SOLANA",
                    payload.rate ?? null,
                    status,
                    payload,
                ],
            );
            console.log(`[PAJ Webhook] On-Ramp order ${id} updated to ${status}`);
        } else if (transactionType === "OFF_RAMP") {
            // Handle Off-Ramp update
            await pool.query(
                `INSERT INTO paj_offramp_orders
                 (id, account_number, bank, currency, amount_usdc, amount_fiat, rate, fee, status, raw_payload, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                 ON CONFLICT (id) DO UPDATE
                   SET status      = EXCLUDED.status,
                       amount_fiat = COALESCE(EXCLUDED.amount_fiat, paj_offramp_orders.amount_fiat),
                       rate        = COALESCE(EXCLUDED.rate,        paj_offramp_orders.rate),
                       fee         = COALESCE(EXCLUDED.fee,         paj_offramp_orders.fee),
                       raw_payload = EXCLUDED.raw_payload,
                       updated_at  = NOW()`,
                [
                    id,
                    payload.accountNumber ?? "",
                    payload.bank ?? "",
                    payload.currency ?? "NGN",
                    payload.amount ?? 0,
                    payload.fiatAmount ?? null,
                    payload.rate ?? null,
                    payload.fee ?? null,
                    status,
                    payload,
                ],
            );
            console.log(`[PAJ Webhook] Off-Ramp order ${id} updated to ${status}`);
        }
    } catch (err) {
        console.error("[PAJ Webhook] DB error or schema mismatch:", err);
    }
});

/**
 * GET /webhook/paj-ramp/:orderId
 * 
 * Polling endpoint for either On-Ramp or Off-Ramp status.
 * Checks both tables.
 */
router.get("/:orderId", async (req: Request, res: Response) => {
    const { orderId } = req.params;

    if (!orderId) {
        return res.status(400).json({ error: "orderId is required" });
    }

    try {
        // First try On-Ramp table
        const onrampResult = await pool.query(
            `SELECT id, status, updated_at, 'ON_RAMP' as type FROM paj_onramp_orders WHERE id = $1`,
            [orderId]
        );

        if (onrampResult.rows.length > 0) {
            return res.json(onrampResult.rows[0]);
        }

        // Then try Off-Ramp table
        const offrampResult = await pool.query(
            `SELECT id, status, updated_at, 'OFF_RAMP' as type FROM paj_offramp_orders WHERE id = $1`,
            [orderId]
        );

        if (offrampResult.rows.length > 0) {
            return res.json(offrampResult.rows[0]);
        }

        return res.status(404).json({ error: "Order not found in either table" });
    } catch (err) {
        console.error("[PAJ Webhook] Error fetching order:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
