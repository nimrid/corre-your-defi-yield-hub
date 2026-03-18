import { Router, Request, Response } from "express";
import { pool } from "../db.js";

const router = Router();

/**
 * POST /api/webhooks/paj-onramp
 *
 * Called by PAJ Ramp whenever an on-ramp order status changes.
 * Payload shape (from PAJ SDK webhook example):
 * {
 *   id:              string,
 *   status:          "INIT" | "PAID" | "COMPLETED" | "FAILED" | "CANCELLED",
 *   transactionType: string,   // "ON_RAMP"
 *   fiatAmount:      number,   // NGN amount user sent
 *   currency:        string,   // "NGN"
 *   amount:          number,   // USDC amount to be credited
 *   mint:            string,   // token mint address
 *   recipient:       string,   // user's Solana wallet address
 *   chain:           string,   // "SOLANA"
 *   rate:            number,
 *   bank?:           string,
 *   accountNumber?:  string,
 *   accountName?:    string,
 * }
 */
router.post("/paj-onramp", async (req: Request, res: Response) => {
    // Always respond 200 immediately so PAJ doesn't retry on slow DB writes
    res.status(200).json({ received: true });

    const payload = req.body;
    console.log("[PAJ Onramp Webhook] Received payload:", JSON.stringify(payload, null, 2));

    const { id, status, transactionType } = payload ?? {};

    if (!id || !status) {
        console.warn("[PAJ Onramp Webhook] Missing id or status — ignoring.");
        return;
    }

    // Log the status change clearly
    const statusEmoji: Record<string, string> = {
        INIT: "📝",
        PAID: "💰",
        COMPLETED: "✅",
        FAILED: "❌",
        CANCELLED: "🚫",
    };
    console.log(`[PAJ Onramp Webhook] ${statusEmoji[status] ?? "ℹ️"} Order ${id} — status: ${status} (${transactionType ?? ""})`);

    try {
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

        console.log(`[PAJ Onramp Webhook] Order ${id} upserted — status: ${status}`);
    } catch (err) {
        console.error("[PAJ Onramp Webhook] DB error:", err);
    }
});

/**
 * GET /api/webhooks/paj-onramp/:orderId
 *
 * Lets the frontend poll for the latest status of a specific onramp order.
 */
router.get("/paj-onramp/:orderId", async (req: Request, res: Response) => {
    const { orderId } = req.params;

    if (!orderId) {
        return res.status(400).json({ error: "orderId is required" });
    }

    try {
        const result = await pool.query(
            `SELECT id,
                    account_number  AS "accountNumber",
                    account_name    AS "accountName",
                    bank,
                    currency,
                    amount_usdc     AS "amountUsdc",
                    amount_fiat     AS "amountFiat",
                    mint,
                    recipient,
                    chain,
                    rate,
                    status,
                    created_at      AS "createdAt",
                    updated_at      AS "updatedAt"
               FROM paj_onramp_orders
              WHERE id = $1`,
            [orderId],
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: "Order not found" });
        }

        return res.json(result.rows[0]);
    } catch (err) {
        console.error("[PAJ Onramp Webhook] Error fetching order:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
