import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { recordReferralAction, REFERRAL_POINTS } from '../lib/referral.js';

const router = Router();

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const HELIUS_WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET || '';

interface TokenTransfer {
  mint: string;
  toUserAccount: string;
  fromUserAccount: string;
  tokenAmount: number;
  tokenDecimals: number;
}

interface Transaction {
  type: string;
  signature?: string;
  tokenTransfers?: TokenTransfer[];
}

interface HeliusWebhookPayload {
  transactions: Transaction[];
}

/**
 * Verify a Helius webhook request.
 *
 * Helius does NOT sign webhook bodies (there is no HMAC / `x-helius-signature`).
 * Instead it echoes back, verbatim in the `Authorization` header, whatever
 * static `authHeader` string you configured when the webhook was created. So
 * authenticity is a constant-time comparison of that header against our shared
 * secret — verifying the parsed body is meaningless here.
 *
 * Behaviour:
 *   • secret configured   → require Authorization === secret (fail CLOSED).
 *   • secret NOT configured → warn loudly and allow, so deploying this code
 *     alone never silently breaks live deposit crediting. Set
 *     HELIUS_WEBHOOK_SECRET (and the matching authHeader on the Helius
 *     dashboard) to activate enforcement.
 */
function verifyHeliusAuth(req: Request, secret: string): boolean {
  if (!secret) {
    console.warn(
      '[Helius Webhook] HELIUS_WEBHOOK_SECRET not set — endpoint is UNAUTHENTICATED. ' +
      'Set it and the matching authHeader in the Helius dashboard to enable verification.',
    );
    return true;
  }

  const provided = (req.headers['authorization'] as string) || '';
  const expected = secret;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  // timingSafeEqual throws on length mismatch — guard first so a wrong-length
  // header is a clean reject rather than an exception.
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Update user's USDC balance when a deposit is detected
 */
async function updateUserUSDCBalance(
  walletAddress: string,
  amount: number,
  txSignature: string,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Idempotency guard: if we've already credited this exact signature via the
    // Helius path, skip — Helius retries deliveries and may resend duplicates,
    // which would otherwise double-credit the deposit.
    if (txSignature) {
      const existing = await client.query(
        `SELECT 1 FROM savings_activity
         WHERE tx_signature = $1 AND source = 'helius_webhook'
         LIMIT 1`,
        [txSignature],
      );
      if (existing.rows.length) {
        console.log(`[Helius Webhook] Duplicate deposit ${txSignature} ignored (already credited)`);
        await client.query('ROLLBACK');
        return;
      }
    }

    // Find user by Solana wallet address
    const userResult = await client.query(
      `SELECT u.id, u.privy_user_id
       FROM users u
       JOIN wallets w ON w.user_id = u.id
       WHERE w.address = $1 AND w.chain_type = 'solana'`,
      [walletAddress],
    );

    if (!userResult.rows.length) {
      console.log(`No user found for wallet ${walletAddress}, skipping balance update`);
      await client.query('ROLLBACK');
      return;
    }

    const userId = userResult.rows[0].id;
    const privyUserId = userResult.rows[0].privy_user_id;

    // Record the deposit in savings_activity
    await client.query(
      `INSERT INTO savings_activity
       (user_id, vault_type, direction, usdc_amount, wallet_address, tx_signature, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, 'regular', 'deposit', amount.toString(), walletAddress, txSignature, 'helius_webhook'],
    );

    await client.query('COMMIT');

    // Currently helius webhook only handles 'regular' vault deposits
    await recordReferralAction(userId, "DEPOSIT_STANDARD", REFERRAL_POINTS.DEPOSIT_STANDARD);

    console.log(
      `USDC deposit recorded: ${amount} USDC to user ${privyUserId} (wallet: ${walletAddress})`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user USDC balance:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * POST /api/webhooks/helius
 * Receives Helius webhook notifications for token transfers
 */
router.post('/helius', async (req: Request, res: Response) => {
  try {
    // Verify webhook authenticity (static Authorization header echoed by Helius)
    if (!verifyHeliusAuth(req, HELIUS_WEBHOOK_SECRET)) {
      console.error('[Helius Webhook] Invalid or missing Authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body as HeliusWebhookPayload;

    if (!payload.transactions || !Array.isArray(payload.transactions)) {
      console.warn('Invalid webhook payload structure');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    let processedCount = 0;

    for (const tx of payload.transactions) {
      // Only process token transfers
      if (tx.type !== 'TOKEN_TRANSFER' || !tx.tokenTransfers) {
        continue;
      }

      for (const transfer of tx.tokenTransfers) {
        // Only process USDC transfers
        if (transfer.mint !== USDC_MINT) {
          continue;
        }

        try {
          // Convert token amount to human-readable format (USDC has 6 decimals)
          const humanAmount = transfer.tokenAmount / Math.pow(10, transfer.tokenDecimals || 6);

          await updateUserUSDCBalance(transfer.toUserAccount, humanAmount, tx.signature || '');

          processedCount++;
        } catch (error) {
          console.error(`Error processing USDC transfer to ${transfer.toUserAccount}:`, error);
          // Continue processing other transfers
        }
      }
    }

    console.log(`Helius webhook processed ${processedCount} USDC deposits`);
    return res.json({ success: true, processed: processedCount });
  } catch (error) {
    console.error('Helius webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
