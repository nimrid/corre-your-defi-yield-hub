import express from "express";
import crypto from "crypto";
import { pool } from "../db.js";

const router = express.Router();

// Privy webhook secret - set this in your .env file
const PRIVY_WEBHOOK_SECRET = process.env.PRIVY_WEBHOOK_SECRET || "";

/**
 * Verify Privy webhook signature
 * Privy sends a signature in the 'privy-signature' header
 */
function verifyPrivySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret) {
    console.warn("PRIVY_WEBHOOK_SECRET not set - skipping signature verification");
    return true; // Allow in development, but log warning
  }

  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (err) {
    console.error("Error verifying Privy signature:", err);
    return false;
  }
}

/**
 * Privy Transaction Webhook Handler
 * Handles transaction lifecycle events from Privy
 */
router.post("/privy/transactions", async (req, res) => {
  try {
    const signature = req.headers["privy-signature"] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!verifyPrivySignature(payload, signature, PRIVY_WEBHOOK_SECRET)) {
      console.error("Invalid Privy webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { type, data } = req.body;

    console.log(`Received Privy webhook: ${type}`, data);

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
        console.log(`Unhandled Privy webhook type: ${type}`);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error processing Privy webhook:", err);
    // Still return 200 to prevent retries for unrecoverable errors
    return res.status(200).json({ success: false });
  }
});

async function handleTransactionBroadcasted(data: any) {
  const { transaction_id, wallet_id, caip2, user_operation_hash } = data;

  console.log(`Transaction broadcasted: ${transaction_id}`, {
    wallet_id,
    caip2,
    user_operation_hash,
  });

  // Store transaction status in database
  await pool.query(
    `INSERT INTO privy_transactions 
     (transaction_id, wallet_id, caip2, user_operation_hash, status, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (transaction_id) 
     DO UPDATE SET status = $5, updated_at = NOW()`,
    [transaction_id, wallet_id, caip2, user_operation_hash, "broadcasted"]
  );
}

async function handleTransactionConfirmed(data: any) {
  const {
    transaction_id,
    wallet_id,
    caip2,
    transaction_hash,
    user_operation_hash,
  } = data;

  console.log(`Transaction confirmed: ${transaction_id}`, {
    transaction_hash,
    wallet_id,
  });

  // Update transaction status
  await pool.query(
    `UPDATE privy_transactions 
     SET status = $1, transaction_hash = $2, confirmed_at = NOW(), updated_at = NOW()
     WHERE transaction_id = $3`,
    ["confirmed", transaction_hash, transaction_id]
  );

  // You can add additional logic here, such as:
  // - Updating user balances
  // - Sending notifications
  // - Triggering other workflows
}

async function handleTransactionReverted(data: any) {
  const { transaction_id, transaction_hash } = data;

  console.log(`Transaction reverted: ${transaction_id}`, { transaction_hash });

  await pool.query(
    `UPDATE privy_transactions 
     SET status = $1, transaction_hash = $2, reverted_at = NOW(), updated_at = NOW()
     WHERE transaction_id = $3`,
    ["reverted", transaction_hash, transaction_id]
  );
}

async function handleTransactionFailed(data: any) {
  const { transaction_id } = data;

  console.log(`Transaction failed: ${transaction_id}`);

  await pool.query(
    `UPDATE privy_transactions 
     SET status = $1, failed_at = NOW(), updated_at = NOW()
     WHERE transaction_id = $2`,
    ["failed", transaction_id]
  );
}

async function handleTransactionReplaced(data: any) {
  const { transaction_id, replacement_transaction_id } = data;

  console.log(`Transaction replaced: ${transaction_id} -> ${replacement_transaction_id}`);

  await pool.query(
    `UPDATE privy_transactions 
     SET status = $1, replacement_transaction_id = $2, replaced_at = NOW(), updated_at = NOW()
     WHERE transaction_id = $3`,
    ["replaced", replacement_transaction_id, transaction_id]
  );
}

export default router;
