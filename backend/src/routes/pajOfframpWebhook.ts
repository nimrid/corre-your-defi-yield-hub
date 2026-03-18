import { Router, Request, Response } from "express";
import { pool } from "../db.js";

const router = Router();

/**
 * POST /api/webhooks/paj-offramp
 *
 * Called by PAJ Ramp whenever an off-ramp order status changes.
 * Payload shape (from PAJ docs):
 * {
 *   id: string,
 *   status: "INIT" | "PROCESSING" | "COMPLETED" | "FAILED",
 *   amount: number,       // USDC amount
 *   fiatAmount: number,
 *   currency: string,
 *   rate: number,
 *   fee: number,
 *   bank?: string,
 *   accountNumber?: string,
 * }
 */
router.post("/paj-offramp", async (req: Request, res: Response) => {
    // Always respond 200 immediately so PAJ doesn't retry on slow DB writes
    res.status(200).json({ received: true });

    const payload = req.body;
    console.log("[PAJ Webhook] Received payload:", JSON.stringify(payload, null, 2));

    const { id, status, amount, fiatAmount, currency, rate, fee } = payload ?? {};

    if (!id || !status) {
        console.warn("[PAJ Webhook] Missing id or status — ignoring.");
        return;
    }

    try {
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
                currency ?? "NGN",
                amount ?? 0,
                fiatAmount ?? null,
                rate ?? null,
                fee ?? null,
                status,
                payload,
            ],
        );

        console.log(`[PAJ Webhook] Order ${id} upserted — status: ${status}`);
    } catch (err) {
        console.error("[PAJ Webhook] DB error:", err);
    }
});

/**
 * GET /api/webhooks/paj-offramp/:orderId
 *
 * Lets the frontend poll for the latest status of a specific order.
 */
router.get("/paj-offramp/:orderId", async (req: Request, res: Response) => {
    const { orderId } = req.params;

    if (!orderId) {
        return res.status(400).json({ error: "orderId is required" });
    }

    try {
        const result = await pool.query(
            `SELECT id, account_number AS "accountNumber", bank, currency,
              amount_usdc AS "amountUsdc", amount_fiat AS "amountFiat",
              rate, fee, status, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM paj_offramp_orders
        WHERE id = $1`,
            [orderId],
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: "Order not found" });
        }

        return res.json(result.rows[0]);
    } catch (err) {
        console.error("[PAJ Webhook] Error fetching order:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
