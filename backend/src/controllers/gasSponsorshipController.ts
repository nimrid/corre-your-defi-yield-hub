import type { Request, Response } from "express";
import { pool } from "../db.js";
import {
  checkGasSponsorshipEligibility,
  detectSuspiciousPatterns,
  logSuspiciousActivity,
  checkCircuitBreaker,
} from "../middleware/gasSponsorship.js";

/**
 * POST /gas-sponsorship/check
 * Body validated by GasSponsorshipCheckSchema before reaching here.
 */
export async function checkGasSponsorship(req: Request, res: Response) {
  const { privyUserId, amountUSD } = req.body as {
    privyUserId: string;
    amountUSD: number;
  };

  try {
    const circuitBreaker = await checkCircuitBreaker();
    if (!circuitBreaker.enabled) {
      return res.json({ allowed: false, reason: circuitBreaker.reason });
    }

    const eligibility = await checkGasSponsorshipEligibility(privyUserId, amountUSD);

    if (!eligibility.allowed) {
      // Fire-and-forget — don't block the response
      logSuspiciousActivity(privyUserId, "rate_limit_exceeded", {
        amountUSD,
        reason: eligibility.reason,
      }).catch((err) => console.error("Error logging suspicious activity:", err));
    }

    detectSuspiciousPatterns(privyUserId)
      .then((patterns) => {
        if (patterns.suspicious) {
          console.warn("Suspicious patterns detected:", patterns.reasons);
          return logSuspiciousActivity(privyUserId, "suspicious_pattern", {
            reasons: patterns.reasons,
          });
        }
      })
      .catch((err) => console.error("Error in suspicion check:", err));

    const responseData: any = { ...eligibility };

    if (eligibility.allowed && process.env.FEE_PAYER_PRIVATE_KEY) {
      try {
        const { Keypair } = await import("@solana/web3.js");
        const bs58 = (await import("bs58")).default;
        const feePayerWallet = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_PRIVATE_KEY));
        responseData.feePayerAddress = feePayerWallet.publicKey.toBase58();
      } catch (err) {
        console.error("Failed to parse FEE_PAYER_PRIVATE_KEY for check request", err);
      }
    }

    return res.json(responseData);
  } catch (err) {
    console.error("Error checking gas sponsorship eligibility:", err);
    // Fail closed on sponsorship (don't spend fee payer funds we couldn't vet)
    // while still letting the user proceed paying their own gas.
    return res.json({
      allowed: true,
      sponsorshipAllowed: false,
      reason: "Eligibility check unavailable — gas sponsorship disabled for this transaction",
    });
  }
}

/**
 * GET /gas-sponsorship/stats
 */
export async function getGasSponsorshipStats(_req: Request, res: Response) {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [txStats, suspiciousStats, circuitBreaker] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= $1) AS daily_tx_count,
           COUNT(*) FILTER (WHERE created_at >= $2) AS weekly_tx_count,
           COALESCE(SUM(amount::numeric) FILTER (WHERE created_at >= $1), 0) AS daily_spend,
           COALESCE(SUM(amount::numeric) FILTER (WHERE created_at >= $2), 0) AS weekly_spend
         FROM transactions
         WHERE direction = 'outgoing' AND source = 'send_wallet'`,
        [oneDayAgo, oneWeekAgo]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= $1) AS daily_suspicious,
           COUNT(*) FILTER (WHERE created_at >= $2) AS weekly_suspicious
         FROM suspicious_activity`,
        [oneDayAgo, oneWeekAgo]
      ),
      checkCircuitBreaker(),
    ]);

    return res.json({
      transactions: {
        daily: parseInt(txStats.rows[0].daily_tx_count || "0"),
        weekly: parseInt(txStats.rows[0].weekly_tx_count || "0"),
      },
      spending: {
        daily: parseFloat(txStats.rows[0].daily_spend || "0"),
        weekly: parseFloat(txStats.rows[0].weekly_spend || "0"),
      },
      suspicious: {
        daily: parseInt(suspiciousStats.rows[0].daily_suspicious || "0"),
        weekly: parseInt(suspiciousStats.rows[0].weekly_suspicious || "0"),
      },
      circuitBreaker: {
        enabled: circuitBreaker.enabled,
        reason: circuitBreaker.reason,
      },
    });
  } catch (err) {
    console.error("Error fetching gas sponsorship stats:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /gas-sponsorship/sponsor-transaction
 * Receives a partially signed transaction, adds fee payer signature, and broadcasts.
 */
export async function sponsorTransaction(req: Request, res: Response) {
  try {
    const { transaction: serializedTransaction } = req.body ?? {};

    // ── Input validation ───────────────────────────────────────────────────
    if (typeof serializedTransaction !== "string" || !serializedTransaction) {
      return res.status(400).json({ error: 'Missing transaction data' });
    }
    // Reject anything that isn't plausibly a base64 transaction, and cap the
    // size so we never hand a giant/garbage buffer to the deserializer.
    if (serializedTransaction.length > 8192 || !/^[A-Za-z0-9+/=]+$/.test(serializedTransaction)) {
      return res.status(400).json({ error: 'Malformed transaction data' });
    }

    // ── Circuit breaker kill-switch ────────────────────────────────────────
    // Lets us instantly halt ALL gas sponsorship (e.g. on detected fee-payer
    // drain) without a redeploy, by inserting an active breaker row. When no
    // breaker is set (the normal case) this is a no-op.
    const breaker = await checkCircuitBreaker();
    if (!breaker.enabled) {
      console.warn("[GasSponsor] Refusing to sponsor — circuit breaker active:", breaker.reason);
      return res.status(503).json({ error: breaker.reason || "Gas sponsorship temporarily disabled" });
    }

    const { Keypair, VersionedTransaction, Connection } = await import("@solana/web3.js");
    const bs58 = (await import("bs58")).default;

    const FEE_PAYER_PRIVATE_KEY = process.env.FEE_PAYER_PRIVATE_KEY;
    if (!FEE_PAYER_PRIVATE_KEY) {
      console.warn("FEE_PAYER_PRIVATE_KEY is not configured in the environment");
      return res.status(500).json({ error: "Server misconfiguration: missing fee payer" });
    }
    const feePayerWallet = Keypair.fromSecretKey(bs58.decode(FEE_PAYER_PRIVATE_KEY));
    const FEE_PAYER_ADDRESS = feePayerWallet.publicKey.toBase58();

    // Use VITE_SOLANA_RPC or VITE_HELIUS_RPC_URL from .env, falling back to a public node if neither exists
    let SOLANA_RPC = process.env.VITE_SOLANA_RPC || process.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
    // Strip possible quotes if dotenv parsed them entirely
    SOLANA_RPC = SOLANA_RPC.replace(/^['"]|['"]$/g, "").trim();

    const connection = new Connection(SOLANA_RPC);

    const transactionBuffer = Buffer.from(serializedTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    // Verify fee payer
    const message = transaction.message;

    let addressLookupTableAccounts: any[] = [];
    if (message.addressTableLookups && message.addressTableLookups.length > 0) {
      const lookups = await Promise.all(
        message.addressTableLookups.map((lookup) => connection.getAddressLookupTable(lookup.accountKey))
      );
      addressLookupTableAccounts = lookups.map((l) => l.value).filter((l) => l !== null);
    }

    const accountKeys = message.getAccountKeys({ addressLookupTableAccounts });
    const feePayer = accountKeys.get(0);

    if (!feePayer || feePayer.toBase58() !== FEE_PAYER_ADDRESS) {
      return res.status(403).json({ error: 'Invalid fee payer in transaction' });
    }

    // Verify authorized actions (no funds transfer from fee payer)
    for (const instruction of message.compiledInstructions) {
      const programId = accountKeys.get(instruction.programIdIndex);
      if (programId && programId.toBase58() === '11111111111111111111111111111111') {
        if (instruction.data[0] === 2) { // 2 = Transfer
          const senderIndex = instruction.accountKeyIndexes[0];
          const senderAddress = accountKeys.get(senderIndex);
          if (senderAddress && senderAddress.toBase58() === FEE_PAYER_ADDRESS) {
            return res.status(403).json({ error: 'Transaction attempts to transfer funds from fee payer' });
          }
        }
      }
    }

    // Sign with fee payer
    transaction.sign([feePayerWallet]);

    // Send transaction
    const signature = await connection.sendTransaction(transaction);

    return res.status(200).json({
      transactionHash: signature,
      message: 'Transaction sent successfully'
    });
  } catch (error: any) {
    console.error('Error processing sponsored transaction:', error);
    return res.status(500).json({
      error: 'Failed to process transaction',
      details: error.message
    });
  }
}
