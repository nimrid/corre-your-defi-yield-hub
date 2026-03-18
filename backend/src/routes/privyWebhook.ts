import { Router, Request, Response, raw } from "express";
import { Webhook } from "svix";
import { pool } from "../db.js";

const router = Router();

// Set in your backend .env — get the value from the Privy dashboard under Webhooks
// It looks like: whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
const PRIVY_WEBHOOK_SECRET = process.env.PRIVY_WEBHOOK_SECRET || "";

/**
 * Middleware: capture raw body for Svix signature verification.
 * Must be applied BEFORE express.json() parses the request body.
 * Mounted specifically on the privy webhook route so it doesn't affect others.
 */
router.use(
  "/privy/transactions",
  raw({ type: "application/json" }),
);

/**
 * POST /api/webhooks/privy/transactions
 *
 * Privy uses Svix for signed webhook delivery.
 * Svix sends three headers: svix-id, svix-timestamp, svix-signature
 * The secret is found on the Privy dashboard → Webhooks tab.
 *
 * Event types handled:
 *   transaction.broadcasted
 *   transaction.confirmed
 *   transaction.execution_reverted
 *   transaction.failed
 *   transaction.replaced
 */
router.post("/privy/transactions", async (req: Request, res: Response) => {
  // ── Signature Verification ─────────────────────────────────────────────
  if (!PRIVY_WEBHOOK_SECRET) {
    console.warn("[Privy Webhook] PRIVY_WEBHOOK_SECRET not set — skipping signature verification");
  } else {
    const wh = new Webhook(PRIVY_WEBHOOK_SECRET);
    const headers = {
      "svix-id": req.headers["svix-id"] as string,
      "svix-timestamp": req.headers["svix-timestamp"] as string,
      "svix-signature": req.headers["svix-signature"] as string,
    };

    if (!headers["svix-id"] || !headers["svix-timestamp"] || !headers["svix-signature"]) {
      console.error("[Privy Webhook] Missing svix headers");
      return res.status(401).json({ error: "Missing webhook signature headers" });
    }

    try {
      // `req.body` here is a raw Buffer (because of the `raw()` middleware above)
      wh.verify(req.body as Buffer, headers);
    } catch (err) {
      console.error("[Privy Webhook] Signature verification failed:", err);
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
  }

  // ── Parse Body ─────────────────────────────────────────────────────────
  let event: { type: string; data: any };
  try {
    event = JSON.parse(
      Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body)
    );
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { type, data } = event;
  console.log(`[Privy Webhook] Received event: ${type}`, data);

  // ── Route to handler ───────────────────────────────────────────────────
  try {
    switch (type) {
      case "transaction.broadcasted":
        await handleTransactionBroadcasted(data);
        break;
      case "transaction.confirmed":
        await handleTransactionConfirmed(data);
        break;
      case "transaction.execution_reverted":
        await handleTransactionReverted(data);
        break;
      case "transaction.failed":
        await handleTransactionFailed(data);
        break;
      case "transaction.replaced":
        await handleTransactionReplaced(data);
        break;
      default:
        console.log(`[Privy Webhook] Unhandled event type: ${type}`);
    }
  } catch (err) {
    console.error("[Privy Webhook] Handler error:", err);
    // Still 200 — Svix will otherwise retry indefinitely
    return res.status(200).json({ success: false, error: "Handler error" });
  }

  return res.status(200).json({ success: true });
});

// ── Handlers ──────────────────────────────────────────────────────────────

async function handleTransactionBroadcasted(data: any) {
  const { transaction_id, wallet_id, caip2, user_operation_hash } = data;

  console.log(`[Privy Webhook] 📡 Broadcasted: ${transaction_id}`, { wallet_id, caip2, user_operation_hash });

  await pool.query(
    `INSERT INTO privy_transactions
         (transaction_id, wallet_id, caip2, user_operation_hash, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'broadcasted', NOW(), NOW())
         ON CONFLICT (transaction_id)
         DO UPDATE SET
           status              = 'broadcasted',
           user_operation_hash = COALESCE(EXCLUDED.user_operation_hash, privy_transactions.user_operation_hash),
           updated_at          = NOW()`,
    [transaction_id, wallet_id, caip2, user_operation_hash ?? null],
  );
}

async function handleTransactionConfirmed(data: any) {
  const { transaction_id, wallet_id, caip2, transaction_hash, user_operation_hash } = data;

  console.log(`[Privy Webhook] ✅ Confirmed: ${transaction_id}`, { transaction_hash });

  await pool.query(
    `INSERT INTO privy_transactions
         (transaction_id, wallet_id, caip2, transaction_hash, user_operation_hash, status, confirmed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'confirmed', NOW(), NOW(), NOW())
         ON CONFLICT (transaction_id)
         DO UPDATE SET
           status           = 'confirmed',
           transaction_hash = COALESCE(EXCLUDED.transaction_hash, privy_transactions.transaction_hash),
           confirmed_at     = NOW(),
           updated_at       = NOW()`,
    [transaction_id, wallet_id ?? null, caip2 ?? null, transaction_hash ?? null, user_operation_hash ?? null],
  );
}

async function handleTransactionReverted(data: any) {
  const { transaction_id, transaction_hash } = data;

  console.log(`[Privy Webhook] ↩️ Reverted: ${transaction_id}`, { transaction_hash });

  await pool.query(
    `INSERT INTO privy_transactions
         (transaction_id, wallet_id, caip2, transaction_hash, status, reverted_at, created_at, updated_at)
         VALUES ($1, '', '', $2, 'reverted', NOW(), NOW(), NOW())
         ON CONFLICT (transaction_id)
         DO UPDATE SET
           status           = 'reverted',
           transaction_hash = COALESCE(EXCLUDED.transaction_hash, privy_transactions.transaction_hash),
           reverted_at      = NOW(),
           updated_at       = NOW()`,
    [transaction_id, transaction_hash ?? null],
  );
}

async function handleTransactionFailed(data: any) {
  const { transaction_id } = data;

  console.log(`[Privy Webhook] ❌ Failed: ${transaction_id}`);

  await pool.query(
    `INSERT INTO privy_transactions
         (transaction_id, wallet_id, caip2, status, failed_at, created_at, updated_at)
         VALUES ($1, '', '', 'failed', NOW(), NOW(), NOW())
         ON CONFLICT (transaction_id)
         DO UPDATE SET
           status    = 'failed',
           failed_at = NOW(),
           updated_at = NOW()`,
    [transaction_id],
  );
}

async function handleTransactionReplaced(data: any) {
  const { transaction_id, replacement_transaction_id } = data;

  console.log(`[Privy Webhook] 🔄 Replaced: ${transaction_id} → ${replacement_transaction_id}`);

  await pool.query(
    `INSERT INTO privy_transactions
         (transaction_id, wallet_id, caip2, replacement_transaction_id, status, replaced_at, created_at, updated_at)
         VALUES ($1, '', '', $2, 'replaced', NOW(), NOW(), NOW())
         ON CONFLICT (transaction_id)
         DO UPDATE SET
           status                      = 'replaced',
           replacement_transaction_id  = COALESCE(EXCLUDED.replacement_transaction_id, privy_transactions.replacement_transaction_id),
           replaced_at                 = NOW(),
           updated_at                  = NOW()`,
    [transaction_id, replacement_transaction_id ?? null],
  );
}

export default router;
